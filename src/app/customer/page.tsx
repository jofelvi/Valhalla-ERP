'use client';
export const dynamic = 'force-dynamic';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerDefault() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/customer/home');
  }, [router]);

  return null;
}
