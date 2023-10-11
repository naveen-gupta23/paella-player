import React, { PropsWithChildren, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FiClock } from "react-icons/fi";
import { HiOutlineStatusOffline } from "react-icons/hi";
import { match, useColorScheme } from "@opencast/appkit";

import { useForceRerender } from "../../util";
import { getEventTimeInfo } from "../../util/video";
import { RelativeDate } from "../time";
import PaellaPlayer from "./Paella";


export type PlayerProps = {
    event: PlayerEvent;

    /** A function to execute when an event goes from pending to live or from live to ended. */
    onEventStateChange?: () => void;

    className?: string;
};

export type PlayerEvent = {
    title: string;
    created: string;
    isLive: boolean;
    syncedData: {
        updated: string;
        startTime: string | null;
        endTime: string | null;
        duration: number;
        tracks: readonly Track[];
        captions: readonly Caption[];
        thumbnail: string | null;
    };
};

export type Track = {
    uri: string;
    flavor: string;
    mimetype: string | null;
    resolution: readonly number[] | null;
    isMaster: boolean | null;
};

export type Caption = {
    uri: string;
    lang: string | null;
};

/**
 * Video player.
 *
 * This is currently always Paella, but we once had two players that were used
 * depending on the number of tracks. For now we removed the other player, but
 * we might have multiple players in the future again. That's the reason for
 * leaving a bit of the "dispatch" logic in place.
 */
export const Player: React.FC<PlayerProps> = ({ event, onEventStateChange }) => {
    const { startTime, endTime, hasStarted, hasEnded } = getEventTimeInfo(event);
    const rerender = useForceRerender();

    // When the livestream starts or ends, rerender the parent. We add some
    // extra time (500ms) to be sure the stream is actually already running by
    // that time.
    useEffect(() => {
        const handler = () => {
            rerender();
            onEventStateChange?.();
        };

        const handles: ReturnType<typeof setTimeout>[] = [];
        if (event.isLive && hasStarted === false) {
            handles.push(setTimeout(handler, delayTill(startTime)));
        }
        if (event.isLive && hasEnded === false) {
            handles.push(setTimeout(handler, delayTill(endTime)));
        }
        return () => handles.forEach(clearTimeout);
    });

    return (
        <Suspense fallback={<PlayerFallback image={event.syncedData.thumbnail} />}>
            {event.isLive && (hasStarted === false || hasEnded === true)
                ? <LiveEventPlaceholder {...{
                    ...hasStarted === false
                        ? { mode: "pending", startTime }
                        : { mode: "ended" },
                }} />
                : <LoadPaellaPlayer
                    {...event}
                    {...event.syncedData}
                    previewImage={event.syncedData.thumbnail}
                />}
        </Suspense>
    );
};

/**
 * Returns the duration till `date` as a value suitable for putting into
 * `setTimeout`. We have to do a special treatment as `setTimeout`
 * immediately executes the handler if the number is bigger than 2^31.
 */
const delayTill = (date: Date): number => {
    const raw = date.getTime() - Date.now() + 500;
    return Math.min(raw, 2_147_483_647);
};

/**
 * A more constrained version of the player component for use in normal page flow.
 * You probably want this one.
 * Important note: This needs to be placed inside a `<PlayerContextProvider>`
 * in order to work correctly.
 */
export const InlinePlayer: React.FC<PlayerProps> = ({ className, event, ...playerProps }) => {
    const aspectRatio = getPlayerAspectRatio(event.syncedData.tracks);
    const isDark = useColorScheme().scheme === "dark";

    return (
        <div className={className}>
            <Player {...{ event, ...playerProps }} />
        </div>
    );
};

/**
 * Finds a suitable aspect ratio for our height/width limiting below. For events
 * with multiple streams, we just use 16:9 because it's unclear what else we
 * should use with multi stream video.
 */
export const getPlayerAspectRatio = (tracks: readonly Track[]): [number, number] => {
    const flavors = new Set(tracks.map(t => t.flavor));
    const default_: [number, number] = [16, 9];
    return flavors.size > 1
        ? default_
        : tracks[0].resolution as [number, number] ?? default_;
};


const LoadPaellaPlayer = PaellaPlayer;

/**
 * Suspense fallback while the player JS files are still loading. This is
 * completely unused right now as the player code is embedded in the main
 * bundle. Splitting the bundle is tracked by #257.
 */
const PlayerFallback: React.FC<{ image: string | null }> = ({ image }) => {
    const { t } = useTranslation();

    return (
        <div>
            {image && <img src={image} />}
            <div>
                <div>Loading...</div>
                <div>{t("general.loading")}</div>
            </div>
        </div>
    );
};

export const isHlsTrack = (t: Track) =>
    t.mimetype === "application/x-mpegURL" || t.uri.endsWith(".m3u8");


export const PlayerPlaceholder: React.FC<PropsWithChildren> = ({ children }) => {
    const isDark = useColorScheme().scheme === "dark";
    return <div>
        {children}
    </div>;
};

type LiveEventPlaceholderProps =
    | { mode: "pending"; startTime: Date }
    | { mode: "ended" };

const LiveEventPlaceholder: React.FC<LiveEventPlaceholderProps> = props => {
    const { t } = useTranslation();

    return <PlayerPlaceholder>
        {match(props.mode, {
            "pending": () => <>
                <FiClock />
                <div>{t("video.stream-not-started-yet")}</div>
            </>,
            "ended": () => <>
                <HiOutlineStatusOffline />
                <div>{t("video.stream-ended")}</div>
            </>,
        })}
        {props.mode === "pending" && (
            <div>
                <RelativeDate date={props.startTime} isLive />
            </div>
        )}
    </PlayerPlaceholder>;
};
