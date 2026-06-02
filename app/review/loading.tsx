import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export default function ReviewLoading() {
  return (
    <SkeletonTheme
      baseColor="oklch(0.91 0.014 72)"
      highlightColor="oklch(0.96 0.01 70)"
      borderRadius="1.25rem"
      duration={1.4}
    >
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* ── Left column ─────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Hero card */}
            <div className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
              {/* Badge row */}
              <div className="mb-5">
                <Skeleton width={120} height={22} borderRadius="9999px" />
              </div>

              {/* Cover art + meta */}
              <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
                <Skeleton height={180} borderRadius="1.5rem" />

                <div className="flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    {/* Status badges */}
                    <div className="flex gap-2">
                      <Skeleton width={90} height={22} borderRadius="9999px" />
                    </div>

                    {/* Title + artist */}
                    <div className="space-y-2">
                      <Skeleton height={44} width="80%" borderRadius="0.5rem" />
                      <Skeleton height={24} width="55%" borderRadius="0.5rem" />
                      <Skeleton height={16} width="65%" borderRadius="0.5rem" />
                    </div>
                  </div>

                  {/* State card */}
                  <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                    <Skeleton height={12} width={90} className="mb-2" />
                    <Skeleton count={2} height={14} borderRadius="0.4rem" />
                  </div>
                </div>
              </div>
            </div>

            {/* URL form skeleton */}
            <div className="rounded-[1.75rem] border border-border/70 bg-card/90 p-3 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
              <div className="mb-3 flex items-center gap-2 px-2">
                <Skeleton width={16} height={16} circle />
                <Skeleton width={220} height={14} borderRadius="0.4rem" />
              </div>
              <div className="flex flex-col gap-3 md:flex-row">
                <Skeleton
                  height={56}
                  borderRadius="1.2rem"
                  className="flex-1"
                />
                <Skeleton width={148} height={56} borderRadius="1.2rem" />
              </div>
              <div className="mt-3 px-2">
                <Skeleton height={12} width="70%" borderRadius="0.4rem" />
              </div>
            </div>

            {/* Trust note */}
            <div className="rounded-[1.75rem] border border-border/70 bg-card/80 p-5">
              <Skeleton height={10} width={100} className="mb-3" />
              <Skeleton count={3} height={13} borderRadius="0.4rem" />
            </div>
          </div>

          {/* ── Right column ─────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Critic's read card */}
            <div className="rounded-[2rem] border border-border/70 bg-card/90 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
              <div className="border-b border-border/70 px-6 py-5">
                <Skeleton height={28} width={200} borderRadius="0.5rem" />
                <div className="mt-2">
                  <Skeleton count={2} height={13} borderRadius="0.4rem" />
                </div>
              </div>
              <div className="space-y-5 px-6 py-6">
                {/* Streaming indicator */}
                <div className="flex items-center gap-2">
                  <Skeleton width={16} height={16} circle />
                  <Skeleton width={140} height={13} borderRadius="0.4rem" />
                </div>
                {/* Prose lines */}
                <div className="space-y-3">
                  {[100, 96, 92, 88, 100, 94, 82].map((w, i) => (
                    <Skeleton
                      key={i}
                      height={20}
                      width={`${w}%`}
                      borderRadius="0.4rem"
                    />
                  ))}
                </div>
                <div className="space-y-3 pt-2">
                  {[98, 90, 95, 76].map((w, i) => (
                    <Skeleton
                      key={i}
                      height={20}
                      width={`${w}%`}
                      borderRadius="0.4rem"
                    />
                  ))}
                </div>
                <div className="space-y-3 pt-2">
                  {[93, 88, 82].map((w, i) => (
                    <Skeleton
                      key={i}
                      height={20}
                      width={`${w}%`}
                      borderRadius="0.4rem"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Evidence + Rubric loading row */}
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              {/* Evidence card */}
              <div className="rounded-[2rem] border border-border/70 bg-card/90 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
                <div className="border-b border-border/70 px-6 py-5">
                  <Skeleton height={28} width={160} borderRadius="0.5rem" />
                  <div className="mt-2">
                    <Skeleton count={2} height={13} borderRadius="0.4rem" />
                  </div>
                </div>
                <div className="space-y-4 px-6 py-6">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4"
                    >
                      <Skeleton height={10} width={80} className="mb-3" />
                      <div className="space-y-2">
                        <Skeleton height={13} borderRadius="0.4rem" />
                        <Skeleton
                          height={13}
                          width="88%"
                          borderRadius="0.4rem"
                        />
                        <Skeleton
                          height={13}
                          width="72%"
                          borderRadius="0.4rem"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rubric card */}
              <div className="rounded-[2rem] border border-border/70 bg-card/90 shadow-[0_24px_80px_-52px_rgba(40,28,21,0.45)]">
                <div className="border-b border-border/70 px-6 py-5">
                  <Skeleton height={28} width={180} borderRadius="0.5rem" />
                  <div className="mt-2">
                    <Skeleton count={2} height={13} borderRadius="0.4rem" />
                  </div>
                </div>
                <div className="space-y-5 px-6 py-6">
                  {/* Confidence block */}
                  <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                    <Skeleton height={10} width={110} className="mb-2" />
                    <Skeleton height={16} width="60%" className="mb-2" />
                    <Skeleton count={2} height={13} borderRadius="0.4rem" />
                  </div>
                  {/* Score bars */}
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between">
                        <Skeleton
                          height={14}
                          width={100}
                          borderRadius="0.4rem"
                        />
                        <Skeleton
                          height={14}
                          width={40}
                          borderRadius="0.4rem"
                        />
                      </div>
                      <Skeleton height={8} borderRadius="9999px" />
                      <Skeleton height={12} width="80%" borderRadius="0.4rem" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </SkeletonTheme>
  );
}
