import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import './style.css';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 720,
  height: 1280,
  pixelArt: true,
  backgroundColor: '#1a1c2c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BattleScene],
});
