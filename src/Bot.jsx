import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';

const Bot = ({ game, setGame, setHistory, setWinner, setMoveFrom, setOptionSquares, isFreeMove, moveFrom }) => {
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [botColor, setBotColor] = useState('b'); // Bot plays as black by default

  const makeBotMove = () => {
    if (!game || game.turn() !== botColor || isFreeMove) return;
    
    setIsBotThinking(true);
    
    // Simulate thinking time
    setTimeout(() => {
      try {
        const moves = game.moves({ verbose: true });
        if (moves.length === 0) return;
        
        // Simple bot: pick a random move
        const randomIndex = Math.floor(Math.random() * moves.length);
        const move = moves[randomIndex];
        
        const newGame = new Chess(game.fen());
        newGame.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
        
        setGame(newGame);
        setHistory(prev => [...prev, { san: move.san, color: move.color, fen: game.fen() }]);
        
        // Check for game over
        if (newGame.isCheckmate()) {
          setWinner(newGame.turn() === 'w' ? 'b' : 'w');
        } else if (newGame.isDraw()) {
          setWinner('draw');
        }
      } catch (error) {
        console.error('Bot move error:', error);
      } finally {
        setIsBotThinking(false);
      }
    }, 1000 + Math.random() * 1500); // Think for 1-2.5 seconds
  };

  useEffect(() => {
    if (game && game.turn() === botColor && !isFreeMove && !isBotThinking) {
      makeBotMove();
    }
  }, [game, isBotThinking, isFreeMove, botColor]);

  return null;
};

export default Bot;