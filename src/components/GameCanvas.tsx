import { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'mario' | 'goomba' | 'mushroom' | 'coin' | 'block' | 'pipe' | 'ground' | 'oneup' | 'brick' | 'flag';
  active: boolean;
  vx?: number;
  vy?: number;
  grounded?: boolean;
  collected?: boolean;
  direction?: number;
  big?: boolean;
  solid?: boolean;
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
      big: false
    },
    objects: [],
    camera: { x: 0, y: 0 },
    score: 0,
    lives: 3,
    coins: 0,
    gameRunning: false,
    gameWon: false,
    gameOver: false,
    keys: new Set()
  });

  // Background music
  const playBackgroundMusic = useCallback(() => {
    if (musicRef.current) return; // Already playing
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    musicRef.current = audioContext;
    
    // Simple melody loop for Mario theme
    const notes = [659, 659, 0, 659, 0, 523, 659, 0, 784]; // E5, E5, rest, E5, rest, C5, E5, rest, G5
    const noteDuration = 0.3;
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
  }, []);

  // Sound effects
  const playSound = (type: 'jump' | 'coin' | 'powerup' | 'stomp' | 'death') => {
    // Create simple beep sounds using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    let frequency = 440;
    let duration = 0.1;
    
    switch (type) {
      case 'jump':
        frequency = 523; // C5
        duration = 0.15;
        break;
      case 'coin':
        frequency = 698; // F5
        duration = 0.1;
        break;
      case 'powerup':
        frequency = 880; // A5
        duration = 0.3;
        break;
      case 'stomp':
        frequency = 220; // A3
        duration = 0.1;
        break;
      case 'death':
        frequency = 131; // C3
        duration = 0.5;
        break;
    }
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  };

  // Initialize level
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
      
      // Pipes - these are solid obstacles
      { x: 448, y: 304, width: 64, height: 64, type: 'pipe', active: true, solid: true },
      { x: 608, y: 272, width: 64, height: 96, type: 'pipe', active: true, solid: true },
      { x: 928, y: 240, width: 64, height: 128, type: 'pipe', active: true, solid: true },
      { x: 1344, y: 208, width: 64, height: 160, type: 'pipe', active: true, solid: true },
      
      // Goombas positioned at ground level
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
        width: 20,
        height: 20
      },
      camera: { x: 0, y: 0 },
      score: 0,
      coins: 0,
      gameRunning: true,
      gameWon: false,
      gameOver: false,
      keys: new Set()
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
    
    // Mario overalls
    ctx.fillStyle = '#2E86AB';
    ctx.fillRect(screenX + 2, screenY + 8 * size, 16, 12 * size);
    
    // Mario shirt
    ctx.fillStyle = '#F24236';
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

  // Enhanced Goomba drawing
  const drawGoomba = (ctx: CanvasRenderingContext2D, goomba: GameObject, camera: { x: number; y: number }) => {
    const screenX = goomba.x - camera.x;
    const screenY = goomba.y - camera.y;
    
    // Goomba body
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.roundRect(screenX, screenY + 4, goomba.width, goomba.height - 4, 4);
    ctx.fill();
    
    // Goomba head
    ctx.fillStyle = '#CD853F';
    ctx.beginPath();
    ctx.roundRect(screenX + 2, screenY, goomba.width - 4, 12, 6);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#000000';
    ctx.fillRect(screenX + 4, screenY + 3, 3, 3);
    ctx.fillRect(screenX + 13, screenY + 3, 3, 3);
    
    // Angry eyebrows
    ctx.fillStyle = '#654321';
    ctx.fillRect(screenX + 3, screenY + 1, 5, 2);
    ctx.fillRect(screenX + 12, screenY + 1, 5, 2);
    
    // Teeth
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(screenX + 7, screenY + 8, 2, 2);
    ctx.fillRect(screenX + 11, screenY + 8, 2, 2);
    
    // Feet
    ctx.fillStyle = '#654321';
    ctx.fillRect(screenX + 1, screenY + goomba.height - 2, 4, 2);
    ctx.fillRect(screenX + goomba.width - 5, screenY + goomba.height - 2, 4, 2);
  };

  // Enhanced Mushroom drawing
  const drawMushroom = (ctx: CanvasRenderingContext2D, mushroom: GameObject, camera: { x: number; y: number }) => {
    const screenX = mushroom.x - camera.x;
    const screenY = mushroom.y - camera.y;
    
    // Mushroom cap
    ctx.fillStyle = mushroom.type === 'oneup' ? '#2ECC71' : '#E74C3C';
    ctx.beginPath();
    ctx.roundRect(screenX - 2, screenY, mushroom.width + 4, 12, 6);
    ctx.fill();
    
    // Mushroom stem
    ctx.fillStyle = '#F4D03F';
    ctx.fillRect(screenX + 4, screenY + 8, 8, 8);
    
    // Spots
    ctx.fillStyle = '#FFFFFF';
    if (mushroom.type === 'oneup') {
      // 1UP pattern - green mushroom with "1UP" dots
      ctx.beginPath();
      ctx.arc(screenX + 5, screenY + 4, 2, 0, Math.PI * 2);
      ctx.arc(screenX + 11, screenY + 4, 2, 0, Math.PI * 2);
      ctx.arc(screenX + 8, screenY + 7, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Regular mushroom spots
      ctx.beginPath();
      ctx.arc(screenX + 4, screenY + 4, 2, 0, Math.PI * 2);
      ctx.arc(screenX + 12, screenY + 4, 2, 0, Math.PI * 2);
      ctx.arc(screenX + 8, screenY + 7, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawObject = (ctx: CanvasRenderingContext2D, obj: GameObject, camera: { x: number; y: number }) => {
    const screenX = obj.x - camera.x;
    const screenY = obj.y - camera.y;
    
    switch (obj.type) {
      case 'ground':
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(screenX, screenY, obj.width, obj.height);
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, obj.width, obj.height);
        // Ground texture
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(screenX + 4, screenY + 4, 8, 8);
        ctx.fillRect(screenX + 20, screenY + 4, 8, 8);
        ctx.fillRect(screenX + 4, screenY + 20, 8, 8);
        ctx.fillRect(screenX + 20, screenY + 20, 8, 8);
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
        ctx.fillStyle = '#D2691E';
        ctx.fillRect(screenX, screenY, obj.width, obj.height);
        ctx.strokeStyle = '#A0522D';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, obj.width, obj.height);
        // Brick pattern
        ctx.strokeStyle = '#8B4513';
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
        ctx.fillRect(screenX + 8, screenY + 16, 48, 16);
        
        // Pipe highlights
        ctx.fillStyle = '#58D68D';
        ctx.fillRect(screenX + 4, screenY + 20, 8, obj.height - 20);
        ctx.fillRect(screenX + obj.width - 12, screenY + 20, 8, obj.height - 20);
        break;
        
      case 'coin':
        // Coin animation
        const time = Date.now() / 200;
        const scale = 0.8 + 0.2 * Math.sin(time);
        const coinSize = 12 * scale;
        const offsetX = (16 - coinSize) / 2;
        
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
        drawMushroom(ctx, obj, camera);
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
    }
  };

  // Game loop
  const gameLoop = useCallback(() => {
    if (!gameState.gameRunning) return;

    setGameState(prevState => {
      const newState = { ...prevState };
      const mario = { ...newState.mario };
      const objects = [...newState.objects];

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
        if (obj.active && obj.solid && checkCollision(mario, obj)) {
          console.log(`Solid collision with ${obj.type} at (${obj.x}, ${obj.y}), Mario at (${mario.x}, ${mario.y}), Mario vy: ${mario.vy}, prevY: ${prevY}`);
          
          // Special handling for blocks and bricks when hit from below
          if ((obj.type === 'block' || obj.type === 'brick') && mario.vy < 0 && mario.y + mario.height > obj.y && prevY + mario.height <= obj.y + 5) {
            console.log(`Mario hit ${obj.type} from below! Triggering block interaction.`);
            
            // Mario hits block from below - trigger the block interaction
            mario.vy = 3; // Bounce downward
            mario.y = obj.y + obj.height; // Position Mario just below the block
            
            if (obj.type === 'block') {
              console.log('Question block hit! Spawning item...');
              // Question block - spawn item and change appearance
              obj.type = 'brick'; // Change to empty brick
              
              // Determine what to spawn based on block position
              if (obj.x === 352) {
                // Second question block always spawns mushroom
                console.log('Spawning mushroom from specific block...');
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
                console.log('Mushroom spawned at:', mushroom.x, mushroom.y);
                playSound('powerup');
              } else {
                // Other blocks spawn coins or mushrooms randomly
                if (Math.random() < 0.3) {
                  console.log('Spawning mushroom...');
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
                  console.log('Mushroom spawned at:', mushroom.x, mushroom.y);
                  playSound('powerup');
                } else {
                  console.log('Spawning coin...');
                  // Spawn coin with upward velocity for animation
                  const coin: GameObject = {
                    x: obj.x + 8,
                    y: obj.y - 20,
                    width: 16,
                    height: 16,
                    type: 'coin',
                    active: true,
                    vy: -8, // Strong upward velocity
                    vx: 0
                  };
                  objects.push(coin);
                  console.log('Coin spawned at:', coin.x, coin.y);
                  newState.coins++;
                  newState.score += 200;
                  playSound('coin');
                }
              }
            } else if (obj.type === 'brick' && mario.big) {
              console.log('Big Mario breaking brick!');
              // Big Mario can break bricks
              obj.active = false;
              newState.score += 50;
              playSound('powerup');
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

      // Update Goombas
      objects.forEach(obj => {
        if (obj.type === 'goomba' && obj.active) {
          obj.x += obj.vx || 0;
          
          // Reverse direction at edges or when hitting solid objects
          const nextX = obj.x + (obj.vx || 0) * 2;
          const hitsSolid = objects.some(other => 
            other.active && other.solid &&
            nextX < other.x + other.width && 
            nextX + obj.width > other.x &&
            obj.y < other.y + other.height && 
            obj.y + obj.height > other.y
          );
          
          // Also reverse at level boundaries
          if (hitsSolid || obj.x <= 32 || obj.x >= 1450) {
            obj.vx = -(obj.vx || 0);
            obj.direction = -(obj.direction || 1);
          }
          
          // Keep goombas on ground
          if (obj.y + obj.height < 368) {
            obj.y = 368 - obj.height;
          }
        }
      });

      // Collision detection with interactive objects
      objects.forEach((obj, index) => {
        if (!obj.active) return;

        const collision = checkCollision(mario, obj);

        if (collision) {
          console.log(`Mario collided with ${obj.type} at position (${obj.x}, ${obj.y})`);
          
          switch (obj.type) {
            case 'goomba':
              if (mario.vy > 0 && mario.y < obj.y - 5) {
                // Mario stomps Goomba
                obj.active = false;
                mario.vy = JUMP_FORCE / 2;
                newState.score += 100;
                playSound('stomp');
              } else if (!mario.big) {
                // Mario hits Goomba while small
                newState.lives--;
                playSound('death');
                if (newState.lives <= 0) {
                  newState.gameOver = true;
                  newState.gameRunning = false;
                } else {
                  // Reset Mario position
                  mario.x = 50;
                  mario.y = 300;
                  mario.vx = 0;
                  mario.vy = 0;
                }
              } else {
                // Mario hits Goomba while big - shrink
                mario.big = false;
                mario.height = 20;
                mario.y += 8; // Adjust position after shrinking
                playSound('death');
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

            case 'block':
            case 'brick':
              // Block collision is now handled in the solid collision section above
              // This prevents duplicate handling and ensures proper physics
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
              
            case 'flag':
              newState.gameWon = true;
              newState.gameRunning = false;
              newState.score += 5000;
              break;
          }
        }
      });

      // Update mushrooms, power-ups, and spawned coins
      objects.forEach(obj => {
        if ((obj.type === 'mushroom' || obj.type === 'oneup') && obj.active) {
          obj.x += obj.vx || 0;
          obj.vy = (obj.vy || 0) + GRAVITY;
          obj.y += obj.vy || 0;
          
          // Ground collision for mushrooms
          if (obj.y + obj.height >= 368) {
            obj.y = 368 - obj.height;
            obj.vy = 0;
          }
          
          // Bounce off solid objects
          objects.forEach(other => {
            if (other.active && other.solid && other !== obj && checkCollision(obj, other)) {
              obj.vx = -(obj.vx || 0);
            }
          });
        }

        // Update spawned coins (from blocks) with physics
        if (obj.type === 'coin' && obj.hasOwnProperty('vy') && obj.active) {
          obj.vy = (obj.vy || 0) + GRAVITY;
          obj.y += obj.vy || 0;
          obj.x += obj.vx || 0;
          
          // Remove coin after it falls for a while or goes off screen
          if (obj.y > 450 || (obj.vy && obj.vy > 5)) {
            obj.active = false;
          }
        }
      });

      // Update camera to follow Mario smoothly
      const targetCameraX = Math.max(0, Math.min(mario.x - CANVAS_WIDTH / 2, 1600 - CANVAS_WIDTH));
      newState.camera.x = newState.camera.x + (targetCameraX - newState.camera.x) * 0.1;

      // Check win condition (reach flag)
      if (mario.x > 1500) {
        newState.gameWon = true;
        newState.gameRunning = false;
        newState.score += 5000;
      }

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
          mario.height = 20;
        }
      }

      newState.mario = mario;
      newState.objects = objects;

      return newState;
    });
  }, [gameState.gameRunning]);

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#5DADE2';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw objects
    gameState.objects.forEach(obj => {
      if (obj.active) {
        drawObject(ctx, obj, gameState.camera);
      }
    });

    // Draw Mario
    drawMario(ctx, gameState.mario, gameState.camera);

    // Draw UI with better styling
    ctx.fillStyle = '#000000';
    ctx.fillRect(5, 5, 200, 75);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`MARIO`, 10, 25);
    ctx.fillText(`${gameState.score.toString().padStart(6, '0')}`, 10, 40);
    ctx.fillText(`WORLD`, 80, 25);
    ctx.fillText(`1-1`, 80, 40);
    ctx.fillText(`TIME`, 130, 25);
    ctx.fillText(`999`, 130, 40);
    ctx.fillText(`Lives: ${gameState.lives}`, 10, 60);
    ctx.fillText(`Coins: ${gameState.coins}`, 10, 75);

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
      coins: 0
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
          <p>🎮 Arrow Keys or WASD to move • Space/W/↑ to jump</p>
          <p>🍄 Stomp Goombas • Collect Mushrooms and Coins • Reach the Flag!</p>
          <p>🎵 Listen for jump and coin sound effects!</p>
          {!gameState.gameRunning && !gameState.gameWon && !gameState.gameOver && (
            <p className="mt-2 text-mario-yellow animate-pulse">🚀 Press Start Game to begin your adventure!</p>
          )}
        </div>
      </Card>
    </div>
  );
};
