'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // 重定向到 /home/explore
    router.replace('/home/explore');
  }, [router]);

  return null;
}
