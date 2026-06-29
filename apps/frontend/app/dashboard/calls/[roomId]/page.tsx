'use client';
import dynamic from 'next/dynamic';

const CallRoomClient = dynamic(() => import('./CallRoomClient'), { ssr: false });

export default function CallRoomPage() {
  return <CallRoomClient />;
}
