import { NextResponse } from 'next/server';
import {
  checkSyncStatus,
  resolveConflicts,
  logSyncStatus,
  SyncStatus,
} from '@/lib/rhythm-sync';

export async function GET() {
  try {
    const status = await checkSyncStatus();

    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('获取同步状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取同步状态失败',
        data: null,
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const statusBefore = await checkSyncStatus();

    const resolution = await resolveConflicts();

    const statusAfter = await checkSyncStatus();

    await logSyncStatus(statusAfter);

    return NextResponse.json({
      success: true,
      data: {
        before: statusBefore,
        after: statusAfter,
        resolution,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('同步操作失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '同步操作失败',
        data: null,
      },
      { status: 500 }
    );
  }
}
