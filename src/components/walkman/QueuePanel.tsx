"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { usePlayerStore } from "@/lib/player";
import { formatDuration } from "@/lib/types";
import { TrackRow } from "./TrackRow";
import { CoverArt } from "./CoverArt";
import { EqualizerBars } from "./EqualizerBars";
import { Button } from "@/components/ui/button";

function QueueContent() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.index);
  const contextLabel = usePlayerStore((s) => s.contextLabel);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const clearUpNext = usePlayerStore((s) => s.clearUpNext);
  const toggleQueueOpen = usePlayerStore((s) => s.toggleQueueOpen);

  const upcoming = queue.slice(index + 1);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-base font-bold">Queue</h2>
        <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={toggleQueueOpen} aria-label="Close queue">
          <X className="size-4" />
        </Button>
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {currentTrack ? (
          <>
            <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Now playing</p>
            <div className="flex items-center gap-3 rounded-md bg-white/5 p-2">
              <span className="relative size-10 shrink-0 overflow-hidden rounded">
                <CoverArt src={currentTrack.cover} alt={currentTrack.title} sizes="80px" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-amber-300">{currentTrack.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{currentTrack.artist}</span>
              </span>
              {isPlaying ? <EqualizerBars /> : null}
            </div>

            <p className="px-2 pb-1 pt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Next up{contextLabel ? ` · from ${contextLabel}` : ""}
            </p>
            {upcoming.length === 0 ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">Nothing queued. Play a playlist or add songs to keep the tape rolling.</p>
            ) : (
              <>
                <div className="mb-2 flex justify-end px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearUpNext}
                  >
                    Clear queue
                  </Button>
                </div>
                {upcoming.map((track, i) => {
                  const queueIndex = index + 1 + i;
                  return (
                    <TrackRow
                      key={`${track.id}-${queueIndex}`}
                      track={track}
                      contextTracks={queue}
                      contextLabel={contextLabel || "Queue"}
                      queueIndex={queueIndex}
                      onRemove={() => removeFromQueue(queueIndex)}
                      showAlbum={false}
                    />
                  );
                })}
              </>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium">Your queue is empty</p>
            <p className="text-xs text-muted-foreground">Play something and it will show up here.</p>
          </div>
        )}
      </div>

      {currentTrack ? (
        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-muted-foreground">
          {formatDuration(currentTrack.durationSec)} · {currentTrack.qualityTier.toLowerCase()} · {currentTrack.bitrateKbps} kbps stream
        </div>
      ) : null}
    </div>
  );
}

export function QueuePanel() {
  const queueOpen = usePlayerStore((s) => s.queueOpen);
  const toggleQueueOpen = usePlayerStore((s) => s.toggleQueueOpen);

  return (
    <AnimatePresence>
      {queueOpen ? (
        <>
          <motion.div
            key="queue-backdrop"
            className="fixed inset-0 z-30 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={toggleQueueOpen}
            aria-hidden="true"
          />
          <motion.aside
            key="queue-panel"
            role="dialog"
            aria-label="Playback queue"
            className="fixed inset-y-0 right-0 z-40 w-[340px] max-w-[88vw] border-l border-white/10 bg-zinc-950 shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
          >
            <QueueContent />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
