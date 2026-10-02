import { useEffect, useRef } from 'react';

const waterLayers = [
  { level: 0.52, amplitude: 22, frequency: 0.0054, speed: 0.00028, color: 'rgba(11, 83, 53, 0.28)', glow: 'rgba(45, 190, 119, 0.18)' },
  { level: 0.65, amplitude: 30, frequency: 0.0042, speed: -0.00021, color: 'rgba(17, 111, 68, 0.24)', glow: 'rgba(68, 219, 143, 0.16)' },
  { level: 0.79, amplitude: 38, frequency: 0.0031, speed: 0.00017, color: 'rgba(19, 91, 60, 0.34)', glow: 'rgba(46, 168, 105, 0.2)' },
  { level: 0.93, amplitude: 27, frequency: 0.0046, speed: -0.00024, color: 'rgba(6, 40, 29, 0.4)', glow: 'rgba(26, 119, 76, 0.14)' },
];

function createLightParticles() {
  let seed = 37291;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  return Array.from({ length: 42 }, () => ({
    x: random(),
    y: 0.08 + random() * 0.84,
    radius: 0.8 + random() * 1.7,
    phase: random() * Math.PI * 2,
    speed: 0.00035 + random() * 0.00075,
    drift: 4 + random() * 13,
  }));
}

const lightParticles = createLightParticles();

export default function AnimatedLoginBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !context) return undefined;

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const brandIcon = new Image();
    brandIcon.src = '/docuhenkia-logo.png';
    let animationFrame = 0;
    let viewWidth = window.innerWidth;
    let viewHeight = window.innerHeight;

    const drawWave = (time, layer) => {
      context.beginPath();
      for (let point = 0; point <= viewWidth; point += 14) {
        const primaryWave = Math.sin(point * layer.frequency + time * layer.speed) * layer.amplitude;
        const secondaryWave = Math.sin(point * layer.frequency * 0.47 - time * layer.speed * 1.6) * layer.amplitude * 0.42;
        const longWave = Math.sin(point * layer.frequency * 0.19 + time * layer.speed * 0.62) * layer.amplitude * 0.52;
        const height = viewHeight * layer.level + primaryWave + secondaryWave + longWave;
        if (point === 0) context.moveTo(point, height);
        else context.lineTo(point, height);
      }
      context.lineTo(viewWidth, viewHeight);
      context.lineTo(0, viewHeight);
      context.closePath();
      context.fillStyle = layer.color;
      context.shadowColor = layer.glow;
      context.shadowBlur = 36;
      context.fill();
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
    };

    const drawWaterShimmer = (time) => {
      context.lineWidth = 1;
      for (let streak = 0; streak < 7; streak += 1) {
        const baseline = viewHeight * (0.2 + streak * 0.105);
        context.beginPath();
        for (let point = 0; point <= viewWidth; point += 24) {
          const wave = Math.sin(point * 0.004 + time * 0.00022 + streak * 1.7) * 11
            + Math.sin(point * 0.009 - time * 0.00016 + streak) * 5;
          const height = baseline + wave;
          if (point === 0) context.moveTo(point, height);
          else context.lineTo(point, height);
        }
        context.strokeStyle = `rgba(125, 246, 184, ${0.035 + (streak % 3) * 0.012})`;
        context.stroke();
      }
    };

    const drawParticles = (time) => {
      lightParticles.forEach((particle) => {
        const twinkle = (Math.sin(time * particle.speed + particle.phase) + 1) * 0.5;
        const opacity = 0.18 + twinkle * 0.72;
        const positionX = particle.x * viewWidth;
        const positionY = particle.y * viewHeight + Math.sin(time * 0.00024 + particle.phase) * particle.drift;
        const glow = context.createRadialGradient(positionX, positionY, 0, positionX, positionY, particle.radius * 5);
        glow.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        glow.addColorStop(0.22, `rgba(226, 255, 240, ${opacity * 0.48})`);
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = glow;
        context.beginPath();
        context.arc(positionX, positionY, particle.radius * 5, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = `rgba(255, 255, 255, ${Math.min(1, opacity + 0.15)})`;
        context.beginPath();
        context.arc(positionX, positionY, particle.radius * (0.48 + twinkle * 0.25), 0, Math.PI * 2);
        context.fill();
      });
    };

    const drawBrandEmblem = (time) => {
      if (!brandIcon.complete || !brandIcon.naturalWidth) return;

      const emblemSize = Math.min(118, Math.max(76, Math.min(viewWidth, viewHeight) * 0.12));
      const centerX = viewWidth * 0.84;
      const centerY = viewHeight * 0.25;
      const pulse = (Math.sin(time * 0.0008) + 1) * 0.5;
      const orbitRotation = time * 0.00008;

      context.save();
      context.translate(centerX, centerY);
      context.rotate(orbitRotation);
      context.beginPath();
      context.ellipse(0, 0, emblemSize * 0.82, emblemSize * 0.82, 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(144, 255, 202, ${0.16 + pulse * 0.18})`;
      context.lineWidth = 1;
      context.stroke();
      context.setLineDash([emblemSize * 0.12, emblemSize * 0.1]);
      context.beginPath();
      context.ellipse(0, 0, emblemSize, emblemSize * 0.68, 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(203, 255, 228, ${0.1 + pulse * 0.12})`;
      context.stroke();
      context.setLineDash([]);

      const orbitDotX = Math.cos(time * 0.00032) * emblemSize;
      const orbitDotY = Math.sin(time * 0.00032) * emblemSize * 0.68;
      context.beginPath();
      context.arc(orbitDotX, orbitDotY, 2 + pulse, 0, Math.PI * 2);
      context.fillStyle = `rgba(240, 255, 247, ${0.55 + pulse * 0.35})`;
      context.shadowColor = 'rgba(133, 255, 197, 0.9)';
      context.shadowBlur = 14;
      context.fill();

      context.rotate(-orbitRotation + Math.sin(time * 0.0005) * 0.025);
      context.globalAlpha = 0.55 + pulse * 0.18;
      context.shadowColor = 'rgba(109, 255, 179, 0.9)';
      context.shadowBlur = 24;
      context.drawImage(brandIcon, -emblemSize / 2, -emblemSize / 2, emblemSize, emblemSize);
      context.restore();
    };

    const drawScene = (time) => {
      const background = context.createLinearGradient(0, 0, viewWidth, viewHeight);
      background.addColorStop(0, '#031f17');
      background.addColorStop(0.48, '#06452f');
      background.addColorStop(1, '#031b15');
      context.fillStyle = background;
      context.fillRect(0, 0, viewWidth, viewHeight);

      waterLayers.forEach((layer) => drawWave(time, layer));
      drawWaterShimmer(time);
      drawParticles(time);
      drawBrandEmblem(time);
    };

    const animate = (time) => {
      drawScene(time);
      if (!motionPreference.matches) animationFrame = window.requestAnimationFrame(animate);
    };

    const resizeCanvas = () => {
      viewWidth = window.innerWidth;
      viewHeight = window.innerHeight;
      const resolutionScale = Math.min(0.75, 1280 / viewWidth, 720 / viewHeight);
      canvas.width = Math.max(1, Math.round(viewWidth * resolutionScale));
      canvas.height = Math.max(1, Math.round(viewHeight * resolutionScale));
      context.setTransform(canvas.width / viewWidth, 0, 0, canvas.height / viewHeight, 0, 0);
      window.cancelAnimationFrame(animationFrame);
      animate(motionPreference.matches ? 0 : performance.now());
    };

    window.addEventListener('resize', resizeCanvas);
    motionPreference.addEventListener('change', resizeCanvas);
    brandIcon.addEventListener('load', () => drawScene(performance.now()));
    resizeCanvas();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      motionPreference.removeEventListener('change', resizeCanvas);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas ref={canvasRef} className="login-background" aria-hidden="true" />;
}