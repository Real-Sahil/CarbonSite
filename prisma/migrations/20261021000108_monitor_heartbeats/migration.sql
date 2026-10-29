-- CreateTable
CREATE TABLE "monitor_heartbeats" (
    "job" TEXT NOT NULL,
    "last_run_at" TIMESTAMPTZ(6) NOT NULL,
    "last_success_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "runs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "monitor_heartbeats_pkey" PRIMARY KEY ("job")
);

-- CreateTable
CREATE TABLE "page_timing_days" (
    "day" DATE NOT NULL,
    "page" TEXT NOT NULL,
    "loads" INTEGER NOT NULL DEFAULT 0,
    "slow" INTEGER NOT NULL DEFAULT 0,
    "very_slow" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "page_timing_days_pkey" PRIMARY KEY ("day","page")
);


ALTER TABLE "monitor_heartbeats" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitor_heartbeats_deny_all" ON "monitor_heartbeats" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "page_timing_days" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "page_timing_days_deny_all" ON "page_timing_days" FOR ALL USING (false) WITH CHECK (false);
