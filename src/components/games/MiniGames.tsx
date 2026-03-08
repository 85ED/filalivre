import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function MiniGames() {
  const [activeGame, setActiveGame] = useState<'snake' | 'tetris' | null>(null);

  if (!activeGame) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={() => setActiveGame(null)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-6 max-w-md w-full max-h-96"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-neutral-900">
            {activeGame === 'snake' ? '🐍 Snake' : '⬜ Tetris'}
          </h3>
          <Button
            onClick={() => setActiveGame(null)}
            className="p-1 hover:bg-neutral-100 rounded"
            variant="ghost"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {activeGame === 'snake' && (
          <SnakeGame />
        )}

        {activeGame === 'tetris' && (
          <TetrisGame />
        )}
      </motion.div>
    </motion.div>
  );
}

// Snake Game Simples
export function SnakeGame() {
  const [score, setScore] = useState(0);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-neutral-600">Score: {score}</p>
      <iframe
        src="https://playsnake.org/"
        width="100%"
        height="300"
        style={{ border: 'none', borderRadius: '8px' }}
        title="Snake Game"
      />
      <p className="text-xs text-center text-neutral-500">
        Clique para fechar o jogo
      </p>
    </div>
  );
}

// Tetris Game Simples
export function TetrisGame() {
  const [score, setScore] = useState(0);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-neutral-600">Score: {score}</p>
      <div className="w-full h-72 bg-neutral-900 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl font-bold mb-2">⬜ Tetris</p>
          <p className="text-neutral-400 text-sm">
            Jogo em desenvolvimento.<br />
            Use o Snake enquanto isso!
          </p>
        </div>
      </div>
      <p className="text-xs text-center text-neutral-500">
        Clique para fechar
      </p>
    </div>
  );
}
