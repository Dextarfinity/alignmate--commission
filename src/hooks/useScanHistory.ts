/**
 * useScanHistory — Supabase Persistence Hook
 *
 * Extracts all Supabase scan_history and weekly_progress logic
 * from Camera.tsx into a dedicated custom hook.
 */

import { useRef, useCallback } from "react";
import supabase from "../supabase";
import { useLoading } from "../contexts/LoadingContext";
import toast from "react-hot-toast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getWeekStartMonday = (date: Date): Date => {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useScanHistory() {
  const { showLoading, hideLoading, updateProgress } = useLoading();
  const lastManualSaveAtRef = useRef(0);
  const isSavingLiveResultRef = useRef(false);

  // --- Fetch Weekly Stats ---
  const fetchWeeklyStats = useCallback(
    async (showLoadingIndicator = false) => {
      try {
        if (showLoadingIndicator) {
          showLoading("📊 STATS UPDATE", "Loading weekly statistics...", {
            showProgress: true,
            progress: 0,
          });
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          if (showLoadingIndicator) hideLoading();
          return;
        }

        if (showLoadingIndicator) updateProgress(25);

        const weekStart = getWeekStartMonday(new Date());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        if (showLoadingIndicator) updateProgress(50);

        const { data: scanData, error } = await supabase
          .from("scan_history")
          .select("score, success")
          .eq("user_id", session.user.id)
          .gte("created_at", weekStart.toISOString())
          .lte("created_at", weekEnd.toISOString());

        if (error) {
          console.error("Error fetching weekly stats:", error);
          if (showLoadingIndicator) hideLoading();
          return;
        }

        if (showLoadingIndicator) updateProgress(75);

        const totalScans = scanData?.length || 0;
        const averageScore =
          totalScans > 0
            ? scanData.reduce((sum, scan) => sum + scan.score, 0) / totalScans
            : 0;

        if (showLoadingIndicator) {
          updateProgress(100);
          await new Promise((resolve) => setTimeout(resolve, 300));
          toast.success(
            `📊 Stats updated! ${totalScans} scans this week (${averageScore.toFixed(1)}% avg)`,
            { icon: "📈" },
          );
        }
      } catch (error) {
        console.error("Error in fetchWeeklyStats:", error);
        if (showLoadingIndicator) {
          toast.error("❌ Failed to load weekly statistics");
        }
      } finally {
        if (showLoadingIndicator) hideLoading();
      }
    },
    [showLoading, hideLoading, updateProgress],
  );

  // --- Update Weekly Progress ---
  const updateWeeklyProgress = useCallback(async (userId: string) => {
    try {
      const weekStart = getWeekStartMonday(new Date());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const { data: weekScans, error: statsError } = await supabase
        .from("scan_history")
        .select("score, success")
        .eq("user_id", userId)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString());

      if (statsError) {
        console.error("Error fetching week stats:", statsError);
        return;
      }

      const totalScans = weekScans?.length || 0;
      const successfulScans =
        weekScans?.filter((scan) => scan.success).length || 0;
      const averageScore =
        totalScans > 0
          ? weekScans.reduce((sum, scan) => sum + scan.score, 0) / totalScans
          : 0;

      const { data: existingProgress, error: checkError } = await supabase
        .from("weekly_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("week_start_date", weekStart.toISOString().split("T")[0])
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking existing weekly progress:", checkError);
        return;
      }

      const progressData = {
        user_id: userId,
        week_start_date: weekStart.toISOString().split("T")[0],
        week_end_date: weekEnd.toISOString().split("T")[0],
        total_scans: totalScans,
        successful_scans: successfulScans,
        average_score: Number(averageScore.toFixed(2)),
        updated_at: new Date().toISOString(),
      };

      if (existingProgress) {
        const { error: updateError } = await supabase
          .from("weekly_progress")
          .update(progressData)
          .eq("user_id", userId)
          .eq("week_start_date", weekStart.toISOString().split("T")[0]);

        if (updateError) console.error("Error updating weekly progress:", updateError);
        else console.log("✅ Weekly progress updated:", progressData);
      } else {
        const { error: insertError } = await supabase
          .from("weekly_progress")
          .insert([progressData]);

        if (insertError) console.error("Error inserting weekly progress:", insertError);
        else console.log("✅ Weekly progress inserted:", progressData);
      }
    } catch (error) {
      console.error("Error in updateWeeklyProgress:", error);
    }
  }, []);

  // --- Aggregate All Weekly Progress ---
  const aggregateAllWeeklyProgress = useCallback(async (userId: string) => {
    try {
      console.log("🔄 Starting weekly progress aggregation for user:", userId);

      const { data: earliestScan, error: earliestError } = await supabase
        .from("scan_history")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (earliestError || !earliestScan) {
        console.log("No scan history found for user");
        return;
      }

      const earliestDate = new Date(earliestScan.created_at);
      const currentDate = new Date();
      const weeks: { start: Date; end: Date }[] = [];
      let weekStart = getWeekStartMonday(earliestDate);

      while (weekStart <= currentDate) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        weeks.push({ start: new Date(weekStart), end: new Date(weekEnd) });
        weekStart.setDate(weekStart.getDate() + 7);
      }

      console.log(`📊 Processing ${weeks.length} weeks for aggregation`);

      for (const week of weeks) {
        const { data: weekScans, error: scansError } = await supabase
          .from("scan_history")
          .select("score, success")
          .eq("user_id", userId)
          .gte("created_at", week.start.toISOString())
          .lte("created_at", week.end.toISOString());

        if (scansError) { console.error("Error fetching scans for week:", week.start, scansError); continue; }

        const totalScans = weekScans?.length || 0;
        if (totalScans === 0) continue;

        const successfulScans = weekScans?.filter((scan) => scan.success).length || 0;
        const averageScore = weekScans.reduce((sum, scan) => sum + scan.score, 0) / totalScans;

        const { data: existingWeek, error: checkError } = await supabase
          .from("weekly_progress")
          .select("*")
          .eq("user_id", userId)
          .eq("week_start_date", week.start.toISOString().split("T")[0])
          .single();

        if (checkError && checkError.code !== "PGRST116") { console.error("Error checking existing week:", checkError); continue; }

        const weekData = {
          user_id: userId,
          week_start_date: week.start.toISOString().split("T")[0],
          week_end_date: week.end.toISOString().split("T")[0],
          total_scans: totalScans,
          successful_scans: successfulScans,
          average_score: Number(averageScore.toFixed(2)),
          updated_at: new Date().toISOString(),
        };

        if (existingWeek) {
          await supabase.from("weekly_progress").update(weekData)
            .eq("user_id", userId).eq("week_start_date", week.start.toISOString().split("T")[0]);
        } else {
          await supabase.from("weekly_progress").insert([weekData]);
        }
      }

      console.log("🎉 Weekly progress aggregation completed");
    } catch (error) {
      console.error("Error in aggregateAllWeeklyProgress:", error);
    }
  }, []);

  // --- Check And Run Weekly Aggregation ---
  const checkAndRunWeeklyAggregation = useCallback(
    async (userId: string) => {
      try {
        const lastRunKey = `weekly_aggregation_last_run_${userId}`;
        const lastRun = localStorage.getItem(lastRunKey);
        const currentWeekStart = getWeekStartMonday(new Date());

        let shouldRun = false;
        if (!lastRun) {
          shouldRun = true;
        } else {
          const lastRunDate = new Date(lastRun);
          const lastRunWeekStart = getWeekStartMonday(lastRunDate);
          if (currentWeekStart.getTime() > lastRunWeekStart.getTime()) {
            shouldRun = true;
          }
        }

        if (shouldRun) {
          await aggregateAllWeeklyProgress(userId);
          localStorage.setItem(lastRunKey, new Date().toISOString());
        }
      } catch (error) {
        console.error("Error in checkAndRunWeeklyAggregation:", error);
      }
    },
    [aggregateAllWeeklyProgress],
  );

  return {
    fetchWeeklyStats,
    updateWeeklyProgress,
    aggregateAllWeeklyProgress,
    checkAndRunWeeklyAggregation,
    lastManualSaveAtRef,
    isSavingLiveResultRef,
  };
}
