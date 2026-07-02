'use client';

import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
}

export function AudioVisualizer({ isPlaying }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    alpha: number;
  }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 初始化粒子
    const colors = ['#C15F3C', '#8B7355', '#6B8E8E'];
    particlesRef.current = Array.from({ length: 30 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.3 + 0.1,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制径向渐变背景
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height, 0,
        canvas.width / 2, canvas.height, canvas.height
      );
      
      if (isPlaying) {
        gradient.addColorStop(0, 'rgba(193, 95, 60, 0.03)');
        gradient.addColorStop(0.5, 'rgba(139, 115, 85, 0.02)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(107, 107, 107, 0.01)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 更新和绘制粒子
      particlesRef.current.forEach((particle) => {
        particle.x += particle.vx * (isPlaying ? 2 : 0.5);
        particle.y += particle.vy * (isPlaying ? 2 : 0.5);

        // 边界检测
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // 绘制粒子
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = isPlaying ? particle.alpha : particle.alpha * 0.3;
        ctx.fill();

        // 绘制连线
        if (isPlaying) {
          particlesRef.current.forEach((other) => {
            const dx = particle.x - other.x;
            const dy = particle.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 120) {
              ctx.beginPath();
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(other.x, other.y);
              ctx.strokeStyle = particle.color;
              ctx.globalAlpha = (1 - distance / 120) * 0.15;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          });
        }
      });

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className="audio-bg"
      style={{ background: 'transparent' }}
    />
  );
}
