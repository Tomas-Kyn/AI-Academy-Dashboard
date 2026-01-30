import { createServerSupabaseClient } from '@/lib/supabase-server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Trophy, Users, GitCommit, Target, ArrowRight, TrendingUp, AlertCircle } from 'lucide-react';
import type { ActivityLogWithParticipant } from '@/lib/types';

export const revalidate = 0;

export default async function Dashboard() {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Supabase is not configured.';
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">AI Academy Dashboard</h1>
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              Configuration needed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{message}</p>
            <p>
              Add <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
              <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and{' '}
              <code className="rounded bg-muted px-1">SUPABASE_SERVICE_KEY</code> in Vercel → Project
              → Settings → Environment Variables, then redeploy.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch stats
  let participantCount = 0;
  let submissionCount = 0;
  let activities: ActivityLogWithParticipant[] = [];
  let assignmentCount: number | null = 0;
  let fetchError: string | null = null;

  try {
    const [participantsResult, submissionsResult, activityResult] = await Promise.all([
      supabase.from('participants').select('id', { count: 'exact', head: true }),
      supabase.from('submissions').select('id', { count: 'exact', head: true }),
      supabase
        .from('activity_log')
        .select('*, participants(name, github_username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    participantCount = participantsResult.count ?? 0;
    submissionCount = submissionsResult.count ?? 0;
    activities = (activityResult.data as ActivityLogWithParticipant[]) ?? [];

    const result = await supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true });
    assignmentCount = result.count ?? 0;
  } catch (e) {
    fetchError = e instanceof Error ? e.message : 'Failed to load data from database.';
  }

  const totalPossible = participantCount * (assignmentCount ?? 0);
  const completionRate = totalPossible > 0 ? Math.round((submissionCount / totalPossible) * 100) : 0;

  if (fetchError) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">AI Academy Dashboard</h1>
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              Database not ready
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{fetchError}</p>
            <p>
              Run the schema from <code className="rounded bg-muted px-1">supabase-schema.sql</code> in
              Supabase → SQL Editor, then refresh.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    {
      title: 'Participants',
      value: participantCount,
      icon: Users,
      description: '8 teams, 8 roles',
    },
    {
      title: 'Submissions',
      value: submissionCount,
      icon: GitCommit,
      description: 'Total assignments submitted',
    },
    {
      title: 'Completion Rate',
      value: `${completionRate}%`,
      icon: Target,
      description: 'Overall progress',
    },
    {
      title: 'Assignments',
      value: assignmentCount ?? 0,
      icon: TrendingUp,
      description: '5 days, in-class + homework',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Academy Dashboard</h1>
          <p className="text-muted-foreground">
            Track progress, submissions, and achievements
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/leaderboard">
            <Button className="bg-[#0062FF] hover:bg-[#0052D9]">
              <Trophy className="mr-2 h-4 w-4" />
              View Leaderboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Feed */}
        <ActivityFeed initialData={activities} />

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link
              href="/leaderboard"
              className="flex items-center justify-between p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-[#0062FF]" />
                <div>
                  <p className="font-medium">Leaderboard</p>
                  <p className="text-sm text-muted-foreground">View rankings and points</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/progress"
              className="flex items-center justify-between p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Progress Matrix</p>
                  <p className="text-sm text-muted-foreground">Completion by role and day</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/teams"
              className="flex items-center justify-between p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="font-medium">Teams</p>
                  <p className="text-sm text-muted-foreground">Team standings and members</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/register"
              className="flex items-center justify-between p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <GitCommit className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">Register</p>
                  <p className="text-sm text-muted-foreground">Join the academy</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
