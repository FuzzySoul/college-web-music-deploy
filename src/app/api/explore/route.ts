import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cacheFetch } from '@/lib/cache-fetch';

export async function GET() {
  try {
    const cached = await cacheFetch('/api/cache/explore');
    if (cached) {
      return NextResponse.json(cached);
    }

    const supabaseUrl = process.env.COZE_SUPABASE_URL;
    const supabaseKey = process.env.COZE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const [bannersRes, recommendationsRes, activitiesRes, chartsRes] = await Promise.all([
      supabase
        .from('explore_banners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),

      supabase
        .from('explore_recommendations')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),

      supabase
        .from('explore_activities')
        .select('*')
        .eq('is_active', true)
        .gte('end_time', new Date().toISOString())
        .order('sort_order', { ascending: true }),

      supabase
        .from('explore_charts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ]);

    if (bannersRes.error) {
      console.error('Error fetching banners:', bannersRes.error);
    }
    if (recommendationsRes.error) {
      console.error('Error fetching recommendations:', recommendationsRes.error);
    }
    if (activitiesRes.error) {
      console.error('Error fetching activities:', activitiesRes.error);
    }
    if (chartsRes.error) {
      console.error('Error fetching charts:', chartsRes.error);
    }

    return NextResponse.json({
      success: true,
      data: {
        banners: bannersRes.data || [],
        recommendations: recommendationsRes.data || [],
        activities: activitiesRes.data || [],
        charts: chartsRes.data || [],
      },
    });
  } catch (error) {
    console.error('Explore API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch explore data' },
      { status: 500 }
    );
  }
}
