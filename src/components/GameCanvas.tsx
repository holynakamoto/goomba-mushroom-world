import { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'mario' | 'goomba' | 'mushroom' | 'coin' | 'block' | 'pipe' | 'ground' | 'oneup' | 'brick' | 'flag' | 'fireflower' | 'fireball' | 'piranha' | 'koopa' | 'starman' | 'elevator';
  active: boolean;
  vx?: number;
  vy?: number;
  grounded?: boolean;
  collected?: boolean;
  direction?: number;
  big?: boolean;
  fire?: boolean;
  solid?: boolean;
  bounce?: number;
  shell?: boolean;
  moving?: boolean;
  minY?: number;
  maxY?: number;
  invincible?: number;
  broken?: boolean;
}

interface GameState {
  mario: GameObject;
  objects: GameObject[];
  camera: { x: number; y: number };
  score: number;
  lives: number;
  coins: number;
  gameRunning: boolean;
  gameWon: boolean;
  gameOver: boolean;
  keys: Set<string>;
  currentLevel: number;
  time: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const MARIO_SPEED = 4;
const GOOMBA_SPEED = 1;

export const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const keysRef = useRef<Set<string>>(new Set());
  const musicRef = useRef<AudioContext | null>(null);
  const gameLoopRef = useRef<NodeJS.Timeout>();
  
  const [gameState, setGameState] = useState<GameState>({
    mario: {
      x: 50,
      y: 300,
      width: 20,
      height: 20,
      type: 'mario',
      active: true,
      vx: 0,
      vy: 0,
      grounded: false,
      big: false,
      fire: false,
      invincible: 0
    },
    objects: [],
    camera: { x: 0, y: 0 },
    score: 0,
    lives: 3,
    coins: 0,
    gameRunning: false,
    gameWon: false,
    gameOver: false,
    keys: new Set(),
    currentLevel: 1,
    time: 400
  });

  // Background music
  const playBackgroundMusic = useCallback(() => {
    if (musicRef.current) return;
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    musicRef.current = audioContext;
    
    const notes = gameState.currentLevel === 2 ? 
      [330, 330, 0, 330, 0, 262, 330, 0, 392] : // Underground theme
      [659, 659, 0, 659, 0, 523, 659, 0, 784]; // Overworld theme
    const noteDuration = gameState.currentLevel === 2 ? 0.4 : 0.3;
    let currentNote = 0;
    
    const playNote = () => {
      if (!musicRef.current) return;
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (notes[currentNote] > 0) {
        oscillator.frequency.setValueAtTime(notes[currentNote], audioContext.currentTime);
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + noteDuration * 0.8);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + noteDuration * 0.8);
      }
      
      currentNote = (currentNote + 1) % notes.length;
      setTimeout(playNote, noteDuration * 1000);
    };
    
    playNote();
  }, [gameState.currentLevel]);

  // Sound effects
  const playSound = (type: 'jump' | 'coin' | 'powerup' | 'stomp' | 'death' | 'break' | 'fireball' | 'shrink') => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    let frequency = 440;
    let duration = 0.1;
    
    switch (type) {
      case 'jump':
        frequency = 523;
        duration = 0.15;
        break;
      case 'coin':
        frequency = 698;
        duration = 0.1;
        break;
      case 'powerup':
        frequency = 880;
        duration = 0.3;
        break;
      case 'stomp':
        frequency = 220;
        duration = 0.1;
        break;
      case 'death':
        frequency = 131;
        duration = 0.5;
        break;
      case 'break':
        frequency = 180;
        duration = 0.2;
        break;
      case 'fireball':
        frequency = 800;
        duration = 0.1;
        break;
      case 'shrink':
        frequency = 200;
        duration = 0.4;
        break;
    }
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  };

  // Initialize World 1-1
  const initializeLevel = useCallback(() => {
    const levelObjects: GameObject[] = [
      // Ground blocks
      ...Array.from({ length: 60 }, (_, i) => ({
        x: i * 32,
        y: 368,
        width: 32,
        height: 32,
        type: 'ground' as const,
        active: true,
        solid: true
      })),
      
      // Question blocks with mushrooms
      { x: 256, y: 272, width: 32, height: 32, type: 'block', active: true, solid: true },
      { x: 352, y: 272, width: 32, height: 32, type: 'block', active: true, solid: true },
      { x: 768, y: 272, width: 32, height: 32, type: 'block', active: true, solid: true },
      { x: 1200, y: 272, width: 32, height: 32, type: 'block', active: true, solid: true },
      
      // Brick blocks
      { x: 320, y: 272, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 384, y: 272, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 416, y: 272, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 480, y: 272, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 512, y: 272, width: 32, height: 32, type: 'brick', active: true, solid: true },
      
      // Pipes
      { x: 448, y: 304, width: 64, height: 64, type: 'pipe', active: true, solid: true },
      { x: 608, y: 272, width: 64, height: 96, type: 'pipe', active: true, solid: true },
      { x: 928, y: 240, width: 64, height: 128, type: 'pipe', active: true, solid: true },
      { x: 1344, y: 208, width: 64, height: 160, type: 'pipe', active: true, solid: true },
      
      // Goombas
      { x: 300, y: 336, width: 20, height: 20, type: 'goomba', active: true, vx: -GOOMBA_SPEED, direction: -1 },
      { x: 400, y: 336, width: 20, height: 20, type: 'goomba', active: true, vx: -GOOMBA_SPEED, direction: -1 },
      { x: 520, y: 336, width: 20, height: 20, type: 'goomba', active: true, vx: GOOMBA_SPEED, direction: 1 },
      { x: 680, y: 336, width: 20, height: 20, type: 'goomba', active: true, vx: -GOOMBA_SPEED, direction: -1 },
      { x: 800, y: 336, width: 20, height: 20, type: 'goomba', active: true, vx: GOOMBA_SPEED, direction: 1 },
      { x: 1000, y: 336, width: 20, height: 20, type: 'goomba', active: true, vx: -GOOMBA_SPEED, direction: -1 },
      { x: 1100, y: 336, width: 20, height: 20, type: 'goomba', active: true, vx: GOOMBA_SPEED, direction: 1 },
      { x: 1280, y: 336, width: 20, height: 20, type: 'goomba', active: true, vx: -GOOMBA_SPEED, direction: -1 },
      
      // Coins
      { x: 320, y: 200, width: 16, height: 16, type: 'coin', active: true },
      { x: 480, y: 240, width: 16, height: 16, type: 'coin', active: true },
      { x: 640, y: 200, width: 16, height: 16, type: 'coin', active: true },
      { x: 800, y: 180, width: 16, height: 16, type: 'coin', active: true },
      { x: 1040, y: 200, width: 16, height: 16, type: 'coin', active: true },
      
      // Flag at the end
      { x: 1500, y: 200, width: 32, height: 168, type: 'flag', active: true, solid: true },
    ];

    setGameState(prev => ({
      ...prev,
      objects: levelObjects,
      mario: {
        ...prev.mario,
        x: 50,
        y: 300,
        vx: 0,
        vy: 0,
        grounded: false,
        big: false,
        fire: false,
        width: 20,
        height: 20,
        invincible: 0
      },
      camera: { x: 0, y: 0 },
      score: 0,
      coins: 0,
      gameRunning: true,
      gameWon: false,
      gameOver: false,
      keys: new Set(),
      currentLevel: 1,
      time: 400
    }));
  }, []);

  // Initialize World 1-2 (Underground level)
  const initializeWorld2 = useCallback(() => {
    const levelObjects: GameObject[] = [
      // Ground blocks (underground style)
      ...Array.from({ length: 80 }, (_, i) => ({
        x: i * 32,
        y: 368,
        width: 32,
        height: 32,
        type: 'ground' as const,
        active: true,
        solid: true
      })),
      
      // Ceiling blocks (underground style)
      ...Array.from({ length: 80 }, (_, i) => ({
        x: i * 32,
        y: 0,
        width: 32,
        height: 32,
        type: 'brick' as const,
        active: true,
        solid: true
      })),
      
      // Side walls
      ...Array.from({ length: 11 }, (_, i) => ({
        x: 0,
        y: i * 32 + 32,
        width: 32,
        height: 32,
        type: 'brick' as const,
        active: true,
        solid: true
      })),
      
      // Starting area question blocks
      { x: 128, y: 272, width: 32, height: 32, type: 'block', active: true, solid: true },
      { x: 160, y: 272, width: 32, height: 32, type: 'block', active: true, solid: true },
      
      // Brick blocks with starman
      { x: 192, y: 272, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 224, y: 272, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 256, y: 272, width: 32, height: 32, type: 'brick', active: true, solid: true }, // Contains starman
      
      // Floating platform with coin blocks
      { x: 384, y: 240, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 416, y: 240, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 448, y: 240, width: 32, height: 32, type: 'brick', active: true, solid: true },
      
      // Pipes with Piranha Plants
      { x: 544, y: 304, width: 64, height: 64, type: 'pipe', active: true, solid: true },
      { x: 544, y: 280, width: 16, height: 16, type: 'piranha', active: true, vx: 0, vy: -1, minY: 264, maxY: 304 },
      
      // More question blocks
      { x: 672, y: 272, width: 32, height: 32, type: 'block', active: true, solid: true },
      { x: 704, y: 272, width: 32, height: 32, type: 'block', active: true, solid: true },
      { x: 736, y: 272, width: 32, height: 32, type: 'block', active: true, solid: true },
      
      // Another pipe with Piranha Plant
      { x: 832, y: 304, width: 64, height: 64, type: 'pipe', active: true, solid: true },
      { x: 832, y: 280, width: 16, height: 16, type: 'piranha', active: true, vx: 0, vy: -1, minY: 264, maxY: 304 },
      
      // Brick staircase
      { x: 960, y: 336, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 992, y: 304, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 1024, y: 272, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 1056, y: 240, width: 32, height: 32, type: 'brick', active: true, solid: true },
      
      // Koopa Troopas
      { x: 1120, y: 336, width: 20, height: 20, type: 'koopa', active: true, vx: -1, direction: -1, shell: false },
      { x: 1200, y: 336, width: 20, height: 20, type: 'koopa', active: true, vx: 1, direction: 1, shell: false },
      
      // Moving elevators
      { x: 1280, y: 320, width: 64, height: 16, type: 'elevator', active: true, vy: -1, minY: 240, maxY: 320, moving: true },
      { x: 1400, y: 240, width: 64, height: 16, type: 'elevator', active: true, vy: 1, minY: 240, maxY: 320, moving: true },
      
      // Final pipe with Piranha Plant
      { x: 1520, y: 304, width: 64, height: 64, type: 'pipe', active: true, solid: true },
      { x: 1520, y: 280, width: 16, height: 16, type: 'piranha', active: true, vx: 0, vy: -1, minY: 264, maxY: 304 },
      
      // Underground Goombas
      { x: 250, y: 336, width: 20, height: 20, type: 'goomba', active: true, vx: -GOOMBA_SPEED, direction: -1 },
      { x: 500, y: 336, width: 20, height: 20, type: 'goomba', active: true, vx: GOOMBA_SPEED, direction: 1 },
      { x: 780, y: 336, width: 20, height: 20, type: 'goomba', active: true, vx: -GOOMBA_SPEED, direction: -1 },
      { x: 1350, y: 336, width: 20, height: 20, type: 'goomba', active: true, vx: GOOMBA_SPEED, direction: 1 },
      
      // Underground coins
      { x: 160, y: 200, width: 16, height: 16, type: 'coin', active: true },
      { x: 400, y: 180, width: 16, height: 16, type: 'coin', active: true },
      { x: 432, y: 180, width: 16, height: 16, type: 'coin', active: true },
      { x: 688, y: 200, width: 16, height: 16, type: 'coin', active: true },
      { x: 720, y: 200, width: 16, height: 16, type: 'coin', active: true },
      { x: 1300, y: 150, width: 16, height: 16, type: 'coin', active: true },
      
      // Exit area - high platform leading to warp zone
      { x: 1600, y: 208, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 1632, y: 208, width: 32, height: 32, type: 'brick', active: true, solid: true },
      { x: 1664, y: 208, width: 32, height: 32, type: 'brick', active: true, solid: true },
      
      // Final exit pipe (leads to flag)
      { x: 1728, y: 144, width: 64, height: 224, type: 'pipe', active: true, solid: true },
      
      // Flag at the very end (after warp zone area)
      { x: 1900, y: 200, width: 32, height: 168, type: 'flag', active: true, solid: true },
    ];

    setGameState(prev => ({
      ...prev,
      objects: levelObjects,
      mario: {
        ...prev.mario,
        x: 50,
        y: 300,
        vx: 0,
        vy: 0,
        grounded: false
      },
      camera: { x: 0, y: 0 },
      gameRunning: true,
      currentLevel: 2,
      time: 400
    }));
  }, []);

  // Collision detection helper
  const checkCollision = (obj1: GameObject, obj2: GameObject) => {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
  };

  // Enhanced Mario drawing
  const drawMario = (ctx: CanvasRenderingContext2D, mario: GameObject, camera: { x: number; y: number }) => {
    const screenX = mario.x - camera.x;
    const screenY = mario.y - camera.y;
    const size = mario.big ? 1.2 : 1;
    
    // Invincibility flashing effect
    if (mario.invincible && mario.invincible > 0 && Math.floor(Date.now() / 100) % 2) {
      return; // Skip drawing for flashing effect
    }
    
    // Mario overalls
    ctx.fillStyle = '#2E86AB';
    ctx.fillRect(screenX + 2, screenY + 8 * size, 16, 12 * size);
    
    // Mario shirt
    ctx.fillStyle = mario.fire ? '#FFFFFF' : '#F24236';
    ctx.fillRect(screenX + 4, screenY + 6 * size, 12, 8 * size);
    
    // Mario head
    ctx.fillStyle = '#FFBE9D';
    ctx.fillRect(screenX + 3, screenY + 2, 14, 10 * size);
    
    // Mario hat
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(screenX + 2, screenY, 16, 6 * size);
    
    // Mario hat emblem
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(screenX + 8, screenY + 1, 4, 3 * size);
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(screenX + 9, screenY + 2, 2, 1 * size);
    
    // Eyes
    ctx.fillStyle = '#000000';
    ctx.fillRect(screenX + 6, screenY + 5, 2, 2);
    ctx.fillRect(screenX + 12, screenY + 5, 2, 2);
    
    // Mustache
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(screenX + 7, screenY + 8, 6, 2);
    
    // Shoes
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(screenX + 2, screenY + mario.height - 4, 6, 4);
    ctx.fillRect(screenX + 12, screenY + mario.height - 4, 6, 4);
  };

  const drawObject = (ctx: CanvasRenderingContext2D, obj: GameObject, camera: { x: number; y: number }) => {
    const screenX = obj.x - camera.x;
    const screenY = obj.y - camera.y;
    
    switch (obj.type) {
      case 'ground':
        // Different colors for different levels
        ctx.fillStyle = gameState.currentLevel === 2 ? '#4A4A4A' : '#8B4513';
        ctx.fillRect(screenX, screenY, obj.width, obj.height);
        ctx.strokeStyle = gameState.currentLevel === 2 ? '#2A2A2A' : '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, obj.width, obj.height);
        break;
        
      case 'block':
        ctx.fillStyle = '#F39C12';
        ctx.fillRect(screenX, screenY, obj.width, obj.height);
        ctx.strokeStyle = '#E67E22';
        ctx.lineWidth = 3;
        ctx.strokeRect(screenX, screenY, obj.width, obj.height);
        // Question mark
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('?', screenX + 16, screenY + 22);
        break;
        
      case 'brick':
        if (obj.broken) {
          // Don't draw broken bricks
          return;
        }
        ctx.fillStyle = gameState.currentLevel === 2 ? '#8B4513' : '#D2691E';
        ctx.fillRect(screenX, screenY, obj.width, obj.height);
        ctx.strokeStyle = gameState.currentLevel === 2 ? '#654321' : '#A0522D';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, obj.width, obj.height);
        // Brick pattern
        ctx.strokeStyle = gameState.currentLevel === 2 ? '#5D4037' : '#8B4513';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenX + 16, screenY);
        ctx.lineTo(screenX + 16, screenY + 16);
        ctx.moveTo(screenX, screenY + 16);
        ctx.lineTo(screenX + 32, screenY + 16);
        ctx.stroke();
        break;
        
      case 'pipe':
        // Main pipe body
        ctx.fillStyle = '#27AE60';
        ctx.fillRect(screenX, screenY, obj.width, obj.height);
        ctx.strokeStyle = '#229954';
        ctx.lineWidth = 3;
        ctx.strokeRect(screenX, screenY, obj.width, obj.height);
        
        // Pipe cap
        ctx.fillStyle = '#2ECC71';
        ctx.fillRect(screenX - 4, screenY, obj.width + 8, 16);
        ctx.strokeStyle = '#27AE60';
        ctx.strokeRect(screenX - 4, screenY, obj.width + 8, 16);
        
        // Pipe opening
        ctx.fillStyle = '#1B4F72';
        ctx.fillRect(screenX + 8, screenY + 16, obj.width - 16, 16);
        break;
        
      case 'coin':
        // Coin animation
        const time = Date.now() / 200;
        const scale = 0.8 + 0.2 * Math.sin(time);
        const coinSize = 12 * scale;
        
        ctx.fillStyle = '#F1C40F';
        ctx.beginPath();
        ctx.arc(screenX + 8, screenY + 8, coinSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#F39C12';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Coin center
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(screenX + 8, screenY + 8, coinSize / 3, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'flag':
        // Flag pole
        ctx.fillStyle = '#654321';
        ctx.fillRect(screenX + 14, screenY, 4, obj.height);
        
        // Flag
        ctx.fillStyle = '#E74C3C';
        ctx.fillRect(screenX - 8, screenY, 24, 16);
        
        // Castle at base
        ctx.fillStyle = '#708090';
        ctx.fillRect(screenX + 20, screenY + obj.height - 32, 24, 32);
        ctx.fillRect(screenX + 16, screenY + obj.height - 40, 32, 8);
        break;
        
      case 'mushroom':
      case 'oneup':
        // Mushroom cap
        ctx.fillStyle = obj.type === 'oneup' ? '#2ECC71' : '#E74C3C';
        ctx.beginPath();
        ctx.roundRect(screenX - 2, screenY, obj.width + 4, 12, 6);
        ctx.fill();
        
        // Mushroom stem
        ctx.fillStyle = '#F4D03F';
        ctx.fillRect(screenX + 4, screenY + 8, 8, 8);
        
        // Spots
        ctx.fillStyle = '#FFFFFF';
        if (obj.type === 'oneup') {
          ctx.beginPath();
          ctx.arc(screenX + 5, screenY + 4, 2, 0, Math.PI * 2);
          ctx.arc(screenX + 11, screenY + 4, 2, 0, Math.PI * 2);
          ctx.arc(screenX + 8, screenY + 7, 1.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(screenX + 4, screenY + 4, 2, 0, Math.PI * 2);
          ctx.arc(screenX + 12, screenY + 4, 2, 0, Math.PI * 2);
          ctx.arc(screenX + 8, screenY + 7, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
        
      case 'goomba':
        // Goomba body
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(screenX + 2, screenY + 8, 16, 12);
        
        // Goomba head
        ctx.fillStyle = '#A0522D';
        ctx.beginPath();
        ctx.arc(screenX + 10, screenY + 6, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(screenX + 7, screenY + 4, 2, 0, Math.PI * 2);
        ctx.arc(screenX + 13, screenY + 4, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye pupils
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(screenX + 7, screenY + 4, 1, 0, Math.PI * 2);
        ctx.arc(screenX + 13, screenY + 4, 1, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyebrows (angry look)
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX + 5, screenY + 2);
        ctx.lineTo(screenX + 8, screenY + 1);
        ctx.moveTo(screenX + 12, screenY + 1);
        ctx.lineTo(screenX + 15, screenY + 2);
        ctx.stroke();
        
        // Feet
        ctx.fillStyle = '#654321';
        ctx.fillRect(screenX, screenY + 18, 6, 2);
        ctx.fillRect(screenX + 14, screenY + 18, 6, 2);
        break;
        
      case 'koopa':
        if (obj.shell) {
          // Shell form
          ctx.fillStyle = '#2ECC71';
          ctx.beginPath();
          ctx.arc(screenX + 10, screenY + 10, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#27AE60';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Shell pattern
          ctx.fillStyle = '#F1C40F';
          ctx.fillRect(screenX + 6, screenY + 6, 8, 8);
        } else {
          // Normal Koopa
          ctx.fillStyle = '#2ECC71';
          ctx.fillRect(screenX + 2, screenY + 8, 16, 12);
          
          // Shell
          ctx.fillStyle = '#27AE60';
          ctx.beginPath();
          ctx.arc(screenX + 10, screenY + 6, 8, 0, Math.PI * 2);
          ctx.fill();
          
          // Head
          ctx.fillStyle = '#F1C40F';
          ctx.fillRect(screenX + 6, screenY + 2, 8, 6);
          
          // Eyes
          ctx.fillStyle = '#000000';
          ctx.fillRect(screenX + 7, screenY + 3, 2, 2);
          ctx.fillRect(screenX + 11, screenY + 3, 2, 2);
        }
        break;
        
      case 'piranha':
        // Piranha Plant head
        ctx.fillStyle = '#E74C3C';
        ctx.beginPath();
        ctx.arc(screenX + 8, screenY + 8, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Mouth
        ctx.fillStyle = '#000000';
        ctx.fillRect(screenX + 4, screenY + 6, 8, 4);
        
        // Teeth
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(screenX + 5, screenY + 6, 1, 2);
        ctx.fillRect(screenX + 7, screenY + 6, 1, 2);
        ctx.fillRect(screenX + 9, screenY + 6, 1, 2);
        ctx.fillRect(screenX + 11, screenY + 6, 1, 2);
        
        // Spots
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(screenX + 5, screenY + 3, 1, 0, Math.PI * 2);
        ctx.arc(screenX + 11, screenY + 3, 1, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'elevator':
        // Moving platform
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(screenX, screenY, obj.width, obj.height);
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, obj.width, obj.height);
        
        // Platform details
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(screenX + 4, screenY + 2, obj.width - 8, 4);
        ctx.fillRect(screenX + 4, screenY + 10, obj.width - 8, 4);
        break;
        
      case 'starman':
        // Starman animation
        const starTime = Date.now() / 100;
        const starScale = 0.9 + 0.1 * Math.sin(starTime);
        
        // Star body
        ctx.fillStyle = '#F1C40F';
        ctx.save();
        ctx.translate(screenX + 8, screenY + 8);
        ctx.scale(starScale, starScale);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 144 - 90) * Math.PI / 180;
          const x = Math.cos(angle) * 8;
          const y = Math.sin(angle) * 8;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        
        // Eyes
        ctx.fillStyle = '#000000';
        ctx.fillRect(screenX + 5, screenY + 6, 2, 2);
        ctx.fillRect(screenX + 9, screenY + 6, 2, 2);
        break;
        
      case 'fireflower':
        // Fire flower stem
        ctx.fillStyle = '#2ECC71';
        ctx.fillRect(screenX + 6, screenY + 8, 4, 8);
        
        // Fire flower petals
        ctx.fillStyle = '#E74C3C';
        ctx.beginPath();
        ctx.arc(screenX + 8, screenY + 6, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Fire flower center
        ctx.fillStyle = '#F1C40F';
        ctx.beginPath();
        ctx.arc(screenX + 8, screenY + 6, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Fire flower face
        ctx.fillStyle = '#000000';
        ctx.fillRect(screenX + 6, screenY + 4, 1, 1);
        ctx.fillRect(screenX + 9, screenY + 4, 1, 1);
        ctx.fillRect(screenX + 7, screenY + 7, 2, 1);
        break;
        
      case 'fireball':
        // Fireball animation
        const fireTime = Date.now() / 100;
        const fireScale = 0.8 + 0.3 * Math.sin(fireTime);
        
        // Outer fire
        ctx.fillStyle = '#E74C3C';
        ctx.beginPath();
        ctx.arc(screenX + 4, screenY + 4, 5 * fireScale, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner fire
        ctx.fillStyle = '#F39C12';
        ctx.beginPath();
        ctx.arc(screenX + 4, screenY + 4, 3 * fireScale, 0, Math.PI * 2);
        ctx.fill();
        
        // Core
        ctx.fillStyle = '#F1C40F';
        ctx.beginPath();
        ctx.arc(screenX + 4, screenY + 4, 1.5 * fireScale, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  };

  // Game loop
  const gameLoop = useCallback(() => {
    if (!gameState.gameRunning) return;

    setGameState(prevState => {
      const newState = { ...prevState };
      const mario = { ...newState.mario };
      const objects = [...newState.objects];

      // Decrease invincibility timer
      if (mario.invincible > 0) {
        mario.invincible--;
      }

      // Handle input
      if (newState.keys.has('ArrowLeft') || newState.keys.has('KeyA')) {
        mario.vx = -MARIO_SPEED;
      } else if (newState.keys.has('ArrowRight') || newState.keys.has('KeyD')) {
        mario.vx = MARIO_SPEED;
      } else {
        mario.vx *= 0.85; // Friction
      }

      if ((newState.keys.has('Space') || newState.keys.has('ArrowUp') || newState.keys.has('KeyW')) && mario.grounded) {
        mario.vy = JUMP_FORCE;
        mario.grounded = false;
        playSound('jump');
      }

      // Fireball shooting (X key) - only if Fire Mario
      if (newState.keys.has('KeyX') && mario.fire) {
        // Check if we can shoot (prevent rapid fire)
        const lastFireball = objects.find(obj => obj.type === 'fireball');
        if (!lastFireball || Math.abs(lastFireball.x - mario.x) > 100) {
          const fireball: GameObject = {
            x: mario.x + (mario.vx > 0 ? mario.width : -16),
            y: mario.y + mario.height / 2,
            width: 8,
            height: 8,
            type: 'fireball',
            active: true,
            vx: mario.vx > 0 ? 8 : mario.vx < 0 ? -8 : 8,
            vy: -2,
            bounce: 3
          };
          objects.push(fireball);
          playSound('fireball');
        }
      }

      // Apply gravity
      mario.vy += GRAVITY;
      if (mario.vy > 15) mario.vy = 15; // Terminal velocity

      // Store previous position for collision resolution
      const prevX = mario.x;
      const prevY = mario.y;

      // Update Mario position
      mario.x += mario.vx;
      mario.y += mario.vy;

      // Check collision with solid objects (ground, pipes, blocks)
      let onGround = false;
      objects.forEach(obj => {
        if (obj.active && obj.solid && !obj.broken && checkCollision(mario, obj)) {
          
          // Special handling for blocks and bricks when hit from below
          if ((obj.type === 'block' || obj.type === 'brick') && mario.vy < 0 && prevY >= obj.y + obj.height - 5 && mario.y <= obj.y + obj.height) {
            
            // Mario hits block from below - trigger the block interaction
            mario.vy = 3; // Bounce downward
            mario.y = obj.y + obj.height; // Position Mario just below the block
            
            if (obj.type === 'block') {
              // Question block - spawn item and change appearance
              obj.type = 'brick'; // Change to empty brick
              
              // Determine what to spawn based on block position and level
              if (newState.currentLevel === 1) {
                if (obj.x === 352) {
                  // Second question block always spawns mushroom
                  const mushroom: GameObject = {
                    x: obj.x,
                    y: obj.y - 20,
                    width: 16,
                    height: 16,
                    type: 'mushroom',
                    active: true,
                    vx: 1.5,
                    vy: -2
                  };
                  objects.push(mushroom);
                  playSound('powerup');
                } else if (obj.x === 768) {
                  // Third question block spawns fire flower if Mario is big
                  if (mario.big && !mario.fire) {
                    const fireflower: GameObject = {
                      x: obj.x,
                      y: obj.y - 20,
                      width: 16,
                      height: 16,
                      type: 'fireflower',
                      active: true,
                      vy: -2
                    };
                    objects.push(fireflower);
                    playSound('powerup');
                  } else {
                    // Spawn mushroom if Mario is small
                    const mushroom: GameObject = {
                      x: obj.x,
                      y: obj.y - 20,
                      width: 16,
                      height: 16,
                      type: 'mushroom',
                      active: true,
                      vx: 1.5,
                      vy: -2
                    };
                    objects.push(mushroom);
                    playSound('powerup');
                  }
                } else {
                  // Other blocks spawn coins or mushrooms randomly
                  if (Math.random() < 0.3) {
                    const mushroom: GameObject = {
                      x: obj.x,
                      y: obj.y - 20,
                      width: 16,
                      height: 16,
                      type: Math.random() < 0.15 ? 'oneup' : 'mushroom',
                      active: true,
                      vx: 1.5,
                      vy: -2
                    };
                    objects.push(mushroom);
                    playSound('powerup');
                  } else {
                    // Spawn coin with upward velocity for animation
                    const coin: GameObject = {
                      x: obj.x + 8,
                      y: obj.y - 20,
                      width: 16,
                      height: 16,
                      type: 'coin',
                      active: true,
                      vy: -8,
                      vx: 0
                    };
                    objects.push(coin);
                    newState.coins++;
                    newState.score += 200;
                    playSound('coin');
                  }
                }
              } else if (newState.currentLevel === 2) {
                // Underground level spawns
                if (obj.x === 128 || obj.x === 160) {
                  // Starting blocks spawn coins
                  const coin: GameObject = {
                    x: obj.x + 8,
                    y: obj.y - 20,
                    width: 16,
                    height: 16,
                    type: 'coin',
                    active: true,
                    vy: -8,
                    vx: 0
                  };
                  objects.push(coin);
                  newState.coins++;
                  newState.score += 200;
                  playSound('coin');
                } else {
                  // Other blocks spawn power-ups
                  if (!mario.big) {
                    const mushroom: GameObject = {
                      x: obj.x,
                      y: obj.y - 20,
                      width: 16,
                      height: 16,
                      type: 'mushroom',
                      active: true,
                      vx: 1.5,
                      vy: -2
                    };
                    objects.push(mushroom);
                    playSound('powerup');
                  } else if (!mario.fire) {
                    const fireflower: GameObject = {
                      x: obj.x,
                      y: obj.y - 20,
                      width: 16,
                      height: 16,
                      type: 'fireflower',
                      active: true,
                      vy: -2
                    };
                    objects.push(fireflower);
                    playSound('powerup');
                  } else {
                    // Spawn 1-up if already fire mario
                    const oneup: GameObject = {
                      x: obj.x,
                      y: obj.y - 20,
                      width: 16,
                      height: 16,
                      type: 'oneup',
                      active: true,
                      vx: 1.5,
                      vy: -2
                    };
                    objects.push(oneup);
                    playSound('powerup');
                  }
                }
              }
            } else if (obj.type === 'brick' && mario.big) {
              // Big Mario can break bricks
              obj.active = false;
              obj.broken = true;
              newState.score += 50;
              playSound('break');
              
              // Special brick spawns
              if (newState.currentLevel === 2 && obj.x === 256) {
                // Starman brick in underground level
                const starman: GameObject = {
                  x: obj.x,
                  y: obj.y - 20,
                  width: 16,
                  height: 16,
                  type: 'starman',
                  active: true,
                  vx: 2,
                  vy: -8
                };
                objects.push(starman);
                playSound('powerup');
              }
            }
            return; // Don't do normal collision handling
          }
          
          // Normal collision handling for other cases
          // Determine collision direction
          const overlapX = Math.min(mario.x + mario.width - obj.x, obj.x + obj.width - mario.x);
          const overlapY = Math.min(mario.y + mario.height - obj.y, obj.y + obj.height - mario.y);
          
          if (overlapX < overlapY) {
            // Horizontal collision
            if (mario.x < obj.x) {
              mario.x = obj.x - mario.width;
            } else {
              mario.x = obj.x + obj.width;
            }
            mario.vx = 0;
          } else {
            // Vertical collision
            if (mario.y < obj.y) {
              mario.y = obj.y - mario.height;
              mario.vy = 0;
              mario.grounded = true;
              onGround = true;
            } else {
              mario.y = obj.y + obj.height;
              mario.vy = 0;
            }
          }
        }
      });

      // Ground collision
      if (mario.y + mario.height >= 368) {
        mario.y = 368 - mario.height;
        mario.vy = 0;
        mario.grounded = true;
        onGround = true;
      }

      if (!onGround && mario.vy >= 0) {
        mario.grounded = false;
      }

      // Update enemies and objects
      objects.forEach((obj, index) => {
        if (!obj.active) return;

        switch (obj.type) {
          case 'goomba':
            obj.x += obj.vx || 0;
            
            // Reverse direction at edges or when hitting solid objects
            const nextX = obj.x + (obj.vx || 0) * 2;
            const hitsSolid = objects.some(other => 
              other.active && other.solid && !other.broken &&
              nextX < other.x + other.width && 
              nextX + obj.width > other.x &&
              obj.y < other.y + other.height && 
              obj.y + obj.height > other.y
            );
            
            if (hitsSolid || obj.x <= 32 || obj.x >= 1900) {
              obj.vx = -(obj.vx || 0);
              obj.direction = -(obj.direction || 1);
            }
            
            // Keep goombas on ground
            if (obj.y + obj.height < 368) {
              obj.y = 368 - obj.height;
            }
            break;

          case 'koopa':
            if (obj.shell && obj.vx !== 0) {
              // Moving shell
              obj.x += obj.vx;
              
              // Check for collisions with other enemies
              objects.forEach(other => {
                if (other !== obj && other.active && (other.type === 'goomba' || other.type === 'koopa') && checkCollision(obj, other)) {
                  other.active = false;
                  newState.score += 100;
                  playSound('stomp');
                }
              });
              
              // Reverse direction at walls
              const shellNextX = obj.x + obj.vx * 2;
              const shellHitsSolid = objects.some(other => 
                other.active && other.solid && !other.broken &&
                shellNextX < other.x + other.width && 
                shellNextX + obj.width > other.x &&
                obj.y < other.y + other.height && 
                obj.y + obj.height > other.y
              );
              
              if (shellHitsSolid || obj.x <= 32 || obj.x >= 1900) {
                obj.vx = -obj.vx;
              }
            } else if (!obj.shell) {
              // Normal koopa movement
              obj.x += obj.vx || 0;
              
              const koopaNextX = obj.x + (obj.vx || 0) * 2;
              const koopaHitsSolid = objects.some(other => 
                other.active && other.solid && !other.broken &&
                koopaNextX < other.x + other.width && 
                koopaNextX + obj.width > other.x &&
                obj.y < other.y + other.height && 
                obj.y + obj.height > other.y
              );
              
              if (koopaHitsSolid || obj.x <= 32 || obj.x >= 1900) {
                obj.vx = -(obj.vx || 0);
                obj.direction = -(obj.direction || 1);
              }
            }
            
            // Keep koopas on ground
            if (obj.y + obj.height < 368) {
              obj.y = 368 - obj.height;
            }
            break;

          case 'piranha':
            // Piranha plant movement
            obj.y += obj.vy || 0;
            if (obj.y <= (obj.minY || 200)) {
              obj.vy = 1;
            } else if (obj.y >= (obj.maxY || 300)) {
              obj.vy = -1;
            }
            break;

          case 'elevator':
            // Moving platform
            if (obj.moving) {
              obj.y += obj.vy || 0;
              if (obj.y <= (obj.minY || 200)) {
                obj.vy = 1;
              } else if (obj.y >= (obj.maxY || 320)) {
                obj.vy = -1;
              }
              
              // Move Mario with platform if he's standing on it
              if (mario.grounded && checkCollision(mario, obj) && mario.y <= obj.y) {
                mario.y += obj.vy || 0;
              }
            }
            break;

          case 'mushroom':
          case 'oneup':
          case 'starman':
            obj.x += obj.vx || 0;
            obj.vy = (obj.vy || 0) + GRAVITY;
            obj.y += obj.vy || 0;
            
            // Ground collision for power-ups
            if (obj.y + obj.height >= 368) {
              obj.y = 368 - obj.height;
              obj.vy = 0;
            }
            
            // Bounce off solid objects
            objects.forEach(other => {
              if (other.active && other.solid && !other.broken && other !== obj && checkCollision(obj, other)) {
                obj.vx = -(obj.vx || 0);
              }
            });
            break;

          case 'fireflower':
            obj.vy = (obj.vy || 0) + GRAVITY;
            obj.y += obj.vy || 0;
            
            // Ground collision for fire flowers
            if (obj.y + obj.height >= 368) {
              obj.y = 368 - obj.height;
              obj.vy = 0;
            }
            break;

          case 'fireball':
            obj.x += obj.vx || 0;
            obj.vy = (obj.vy || 0) + GRAVITY * 0.3;
            obj.y += obj.vy || 0;
            
            // Bounce off ground
            if (obj.y + obj.height >= 368) {
              obj.y = 368 - obj.height;
              obj.vy = -Math.abs(obj.vy || 0) * 0.7;
              obj.bounce = (obj.bounce || 0) - 1;
              
              if (obj.bounce <= 0) {
                obj.active = false;
              }
            }
            
            // Remove if off screen
            if (obj.x < -50 || obj.x > 2000) {
              obj.active = false;
            }
            
            // Check fireball collision with enemies
            objects.forEach(enemy => {
              if ((enemy.type === 'goomba' || enemy.type === 'koopa' || enemy.type === 'piranha') && enemy.active && checkCollision(obj, enemy)) {
                enemy.active = false;
                obj.active = false;
                newState.score += 100;
                playSound('stomp');
              }
            });
            break;

          case 'coin':
            // Update spawned coins (from blocks) with physics
            if (obj.hasOwnProperty('vy') && obj.active) {
              obj.vy = (obj.vy || 0) + GRAVITY;
              obj.y += obj.vy || 0;
              obj.x += obj.vx || 0;
              
              // Remove coin after it falls for a while or goes off screen
              if (obj.y > 450 || (obj.vy && obj.vy > 5)) {
                obj.active = false;
              }
            }
            break;
        }
      });

      // Collision detection with interactive objects
      objects.forEach((obj, index) => {
        if (!obj.active) return;

        const collision = checkCollision(mario, obj);

        if (collision) {
          switch (obj.type) {
            case 'goomba':
              if (mario.invincible > 0) {
                // Invincible Mario defeats Goomba
                obj.active = false;
                newState.score += 100;
                playSound('stomp');
              } else if (mario.vy > 0 && mario.y < obj.y - 5) {
                // Mario stomps Goomba
                obj.active = false;
                mario.vy = JUMP_FORCE / 2;
                newState.score += 100;
                playSound('stomp');
              } else {
                // Mario gets hit by Goomba
                if (mario.fire) {
                  // Fire Mario becomes Big Mario
                  mario.fire = false;
                  mario.invincible = 120; // 2 seconds of invincibility
                  playSound('shrink');
                } else if (mario.big) {
                  // Big Mario becomes Small Mario
                  mario.big = false;
                  mario.height = 20;
                  mario.y += 8; // Adjust position after shrinking
                  mario.invincible = 120; // 2 seconds of invincibility
                  playSound('shrink');
                } else {
                  // Small Mario dies
                  newState.lives--;
                  playSound('death');
                  if (newState.lives <= 0) {
                    newState.gameOver = true;
                    newState.gameRunning = false;
                  } else {
                    mario.x = 50;
                    mario.y = 300;
                    mario.vx = 0;
                    mario.vy = 0;
                    mario.invincible = 180; // 3 seconds of invincibility after respawn
                  }
                }
              }
              break;

            case 'koopa':
              if (mario.invincible > 0) {
                // Invincible Mario defeats Koopa
                obj.active = false;
                newState.score += 100;
                playSound('stomp');
              } else if (mario.vy > 0 && mario.y < obj.y - 5) {
                // Mario stomps Koopa
                if (!obj.shell) {
                  obj.shell = true;
                  obj.vx = 0;
                  obj.width = 16;
                  obj.height = 16;
                  mario.vy = JUMP_FORCE / 2;
                  newState.score += 100;
                  playSound('stomp');
                } else {
                  // Kick shell
                  obj.vx = mario.x < obj.x ? 8 : -8;
                  mario.vy = JUMP_FORCE / 2;
                  newState.score += 100;
                  playSound('stomp');
                }
              } else if (obj.shell && obj.vx === 0) {
                // Kick stationary shell
                obj.vx = mario.x < obj.x ? 8 : -8;
                newState.score += 100;
                playSound('stomp');
              } else if (!obj.shell || obj.vx === 0) {
                // Mario gets hit by moving Koopa (same as Goomba)
                if (mario.fire) {
                  mario.fire = false;
                  mario.invincible = 120;
                  playSound('shrink');
                } else if (mario.big) {
                  mario.big = false;
                  mario.height = 20;
                  mario.y += 8;
                  mario.invincible = 120;
                  playSound('shrink');
                } else {
                  newState.lives--;
                  playSound('death');
                  if (newState.lives <= 0) {
                    newState.gameOver = true;
                    newState.gameRunning = false;
                  } else {
                    mario.x = 50;
                    mario.y = 300;
                    mario.vx = 0;
                    mario.vy = 0;
                    mario.invincible = 180;
                  }
                }
              }
              break;

            case 'piranha':
              if (mario.invincible === 0) {
                // Mario gets hit by Piranha Plant
                if (mario.fire) {
                  mario.fire = false;
                  mario.invincible = 120;
                  playSound('shrink');
                } else if (mario.big) {
                  mario.big = false;
                  mario.height = 20;
                  mario.y += 8;
                  mario.invincible = 120;
                  playSound('shrink');
                } else {
                  newState.lives--;
                  playSound('death');
                  if (newState.lives <= 0) {
                    newState.gameOver = true;
                    newState.gameRunning = false;
                  } else {
                    mario.x = 50;
                    mario.y = 300;
                    mario.vx = 0;
                    mario.vy = 0;
                    mario.invincible = 180;
                  }
                }
              }
              break;

            case 'coin':
              obj.active = false;
              newState.coins++;
              newState.score += 200;
              playSound('coin');
              if (newState.coins >= 100) {
                newState.lives++;
                newState.coins = 0;
              }
              break;

            case 'mushroom':
              obj.active = false;
              if (!mario.big) {
                mario.big = true;
                mario.height = 28;
                mario.y -= 8; // Adjust position after growing
              }
              newState.score += 1000;
              playSound('powerup');
              break;

            case 'oneup':
              obj.active = false;
              newState.lives++;
              newState.score += 1000;
              playSound('powerup');
              break;

            case 'starman':
              obj.active = false;
              mario.invincible = 600; // 10 seconds of invincibility
              newState.score += 1000;
              playSound('powerup');
              break;
              
            case 'fireflower':
              obj.active = false;
              if (mario.big) {
                mario.fire = true;
              } else {
                // If small Mario gets fire flower, he becomes big first
                mario.big = true;
                mario.height = 28;
                mario.y -= 8;
              }
              newState.score += 1000;
              playSound('powerup');
              break;

            case 'flag':
              // Transition to next level or complete game
              if (newState.currentLevel === 1) {
                // Go to world 1-2
                setTimeout(() => {
                  initializeWorld2();
                }, 1000);
                newState.score += 5000;
                playSound('powerup');
              } else {
                // Complete the game
                newState.gameWon = true;
                newState.gameRunning = false;
                newState.score += 5000;
              }
              break;
          }
        }
      });

      // Update camera to follow Mario smoothly
      const targetCameraX = Math.max(0, Math.min(mario.x - CANVAS_WIDTH / 2, 2000 - CANVAS_WIDTH));
      newState.camera.x = newState.camera.x + (targetCameraX - newState.camera.x) * 0.1;

      // Check death condition (fall off screen)
      if (mario.y > 500) {
        newState.lives--;
        playSound('death');
        if (newState.lives <= 0) {
          newState.gameOver = true;
          newState.gameRunning = false;
        } else {
          mario.x = 50;
          mario.y = 300;
          mario.vx = 0;
          mario.vy = 0;
          mario.big = false;
          mario.fire = false;
          mario.height = 20;
          mario.invincible = 180;
        }
      }

      // Update timer
      if (newState.time > 0) {
        newState.time -= 1/60; // Decrease by 1 every second (assuming 60 FPS)
        if (newState.time <= 0) {
          newState.time = 0;
          // Time up - Mario dies
          newState.lives--;
          playSound('death');
          if (newState.lives <= 0) {
            newState.gameOver = true;
            newState.gameRunning = false;
          } else {
            mario.x = 50;
            mario.y = 300;
            mario.vx = 0;
            mario.vy = 0;
            mario.big = false;
            mario.fire = false;
            mario.height = 20;
            mario.invincible = 180;
            newState.time = 400;
          }
        }
      }

      newState.mario = mario;
      newState.objects = objects;

      return newState;
    });
  }, [gameState.gameRunning, initializeWorld2]);

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with level-appropriate background
    ctx.fillStyle = gameState.currentLevel === 2 ? '#000080' : '#5DADE2'; // Dark blue for underground
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw objects
    gameState.objects.forEach(obj => {
      if (obj.active && !obj.broken) {
        drawObject(ctx, obj, gameState.camera);
      }
    });

    // Draw Mario
    drawMario(ctx, gameState.mario, gameState.camera);

    // Draw UI with better styling
    ctx.fillStyle = '#000000';
    ctx.fillRect(5, 5, 250, 90);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`MARIO`, 10, 25);
    ctx.fillText(`${gameState.score.toString().padStart(6, '0')}`, 10, 40);
    ctx.fillText(`WORLD`, 80, 25);
    ctx.fillText(`1-${gameState.currentLevel}`, 80, 40);
    ctx.fillText(`TIME`, 130, 25);
    ctx.fillText(`${Math.ceil(gameState.time).toString().padStart(3, '0')}`, 130, 40);
    ctx.fillText(`Lives: ${gameState.lives}`, 10, 60);
    ctx.fillText(`Coins: ${gameState.coins}`, 10, 75);
    
    // Show Mario status
    let status = 'Small Mario';
    if (gameState.mario.fire) status = 'Fire Mario';
    else if (gameState.mario.big) status = 'Super Mario';
    if (gameState.mario.invincible > 0) status += ' (Invincible)';
    ctx.fillText(status, 10, 90);

    // Game over/win messages
    if (gameState.gameWon) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#F1C40F';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WORLD CLEAR!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`Final Score: ${gameState.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    }

    if (gameState.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#E74C3C';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('Press Reset to try again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    }
  }, [gameState]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      gameLoop();
      render();
      animationRef.current = requestAnimationFrame(animate);
    };

    if (gameState.gameRunning) {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameLoop, render, gameState.gameRunning]);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      setGameState(prev => ({
        ...prev,
        keys: new Set([...prev.keys, e.code])
      }));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setGameState(prev => ({
        ...prev,
        keys: new Set([...prev.keys].filter(key => key !== e.code))
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const startGame = () => {
    initializeLevel();
    playBackgroundMusic();
  };

  const resetGame = () => {
    setGameState(prev => ({
      ...prev,
      gameRunning: false,
      gameWon: false,
      gameOver: false,
      lives: 3,
      score: 0,
      coins: 0,
      currentLevel: 1,
      time: 400
    }));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Card className="p-4 bg-game-ui-bg border-game-ui-border">
        <div className="flex gap-4 mb-4">
          <Button 
            onClick={startGame} 
            className="btn-8bit"
            disabled={gameState.gameRunning}
          >
            Start Game
          </Button>
          <Button 
            onClick={resetGame} 
            className="btn-8bit bg-mario-blue"
          >
            Reset
          </Button>
        </div>
        
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="game-canvas bg-mario-sky"
        />
        
        <div className="mt-4 text-center pixel-font text-mario-white">
          <p>🎮 Arrow Keys or WASD to move • Space/W/↑ to jump • X to shoot fireballs (Fire Mario only)</p>
          <p>🍄 Stomp Goombas • Collect Mushrooms and Coins • Break bricks as Big Mario • Reach the Flag!</p>
          <p>🎵 Enhanced with brick breaking, Mario shrinking, fireball shooting, and World 1-2!</p>
          {!gameState.gameRunning && !gameState.gameWon && !gameState.gameOver && (
            <p className="mt-2 text-mario-yellow animate-pulse">🚀 Press Start Game to begin your enhanced adventure!</p>
          )}
        </div>
      </Card>
    </div>
  );
};