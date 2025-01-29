const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const MOVEMENT_SPEED = 5;
const PLATFORM_HEIGHT = 20;
const COIN_SIZE = 20;
const ENEMY_SIZE = 30;
const TOTAL_LEVELS = 5;
const BOSS_HEALTH = 100;
const POWERUP_TYPES = ['speed', 'strength', 'doubleJump', 'shield'];
const LEVEL_TARGETS = [50, 100, 200, 300, 400];

var powerUpTimeouts = [];
let previousLevelMaxScore = 0;
let canvas, ctx;
var player;
let platforms = [];
var coins = [];
let enemies = [];
var particles = [];
let powerUps = [];
var score = 0;
let gameLoop;
let isGameOver = false;
var currentLevel = 1;
let achievements = [];
var bossHealth = BOSS_HEALTH;
let collectedKeys = 0;
const requiredKeys = 3;
var keys = [];
let isLevelTransitioning = false;

function showTutorialSection(sectionNumber) {
    const sections = document.querySelectorAll('.tutorial-section');
    sections.forEach(section => section.classList.remove('active'));

    const activeSection = document.getElementById(`tutorialSection${sectionNumber}`);
    if (activeSection) {
        activeSection.classList.add('active');
    }
}

function startGame() {
    const tutorialOverlay = document.getElementById('tutorialOverlay');
    tutorialOverlay.style.display = 'none';
    init();
}

class Player {
    constructor() {
        this.width = 40;
        this.height = 40;
        this.x = CANVAS_WIDTH / 4;
        this.y = CANVAS_HEIGHT - this.height - PLATFORM_HEIGHT;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isJumping = false;
        this.health = 100;
        this.isInvulnerable = false;
        this.invulnerableTimer = 0;
        this.inventory = [];
    }

    update() {
        this.velocityY += GRAVITY;
        this.x += this.velocityX;
        this.y += this.velocityY;

        for (let platform of platforms) {
            if (this.isColliding(platform)) {
                if (this.velocityY > 0) {
                    this.y = platform.y - this.height;
                    this.velocityY = 0;
                    this.isJumping = false;
                }
            }
        }

        if (this.x < 0) this.x = 0;
        if (this.x + this.width > CANVAS_WIDTH) this.x = CANVAS_WIDTH - this.width;
        if (this.y + this.height > CANVAS_HEIGHT) {
            this.y = CANVAS_HEIGHT - this.height;
            this.velocityY = 0;
            this.isJumping = false;
        }

        if (this.isInvulnerable) {
            this.invulnerableTimer++;
            if (this.invulnerableTimer > 60) {
                this.isInvulnerable = false;
                this.invulnerableTimer = 0;
            }
        }
    }

    draw() {
        if (!this.isInvulnerable || Math.floor(Date.now() / 100) % 2) {
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#000000';
            ctx.fillRect(this.x + 10, this.y + 10, 5, 5);
            ctx.fillRect(this.x + 25, this.y + 10, 5, 5);
            ctx.beginPath();
            ctx.arc(this.x + 20, this.y + 25, 5, 0, Math.PI, false);
            ctx.stroke();
        }
    }

    jump() {
        if (!this.isJumping) {
            this.velocityY = JUMP_FORCE;
            this.isJumping = true;
            createParticles(this.x + this.width / 2, this.y + this.height, 5);
        }
    }

    takeDamage(amount) {
        if (!this.isInvulnerable) {
            this.health -= amount;
            this.isInvulnerable = true;
            createParticles(this.x + this.width / 2, this.y + this.height / 2, 10, '#FF0000');
            if (this.health <= 0) {
                gameOver();
            }
        }
    }

    isColliding(object) {
        return this.x < object.x + object.width &&
            this.x + this.width > object.x &&
            this.y < object.y + object.height &&
            this.y + this.height > object.y;
    }
}

class Platform {
    constructor(x, y, width) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = PLATFORM_HEIGHT;
    }

    draw() {
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = ENEMY_SIZE;
        this.height = ENEMY_SIZE;
        this.velocityX = Math.random() > 0.5 ? 2 : -2;
        this.velocityY = 0;
        this.health = 1;
    }

    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;

        if (this.x <= 0 || this.x + this.width >= CANVAS_WIDTH) {
            this.velocityX *= -1;
        }

        let onPlatform = false;
        for (let platform of platforms) {
            if (this.isColliding(platform)) {
                this.y = platform.y - this.height;
                this.velocityY = 0;
                onPlatform = true;
            }
        }

        if (!onPlatform) {
            this.velocityY += GRAVITY;
        }
    }

    draw() {
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#000000';
        ctx.fillRect(this.x + 5, this.y + 10, 8, 2);
        ctx.fillRect(this.x + this.width - 13, this.y + 10, 8, 2);
    }

    isColliding(object) {
        return this.x < object.x + object.width &&
            this.x + this.width > object.x &&
            this.y < object.y + object.height &&
            this.y + this.height > object.y;
    }
}

class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = COIN_SIZE;
        this.height = COIN_SIZE;
        this.collected = false;
    }

    draw() {
        if (!this.collected) {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(this.x + COIN_SIZE / 2, this.y + COIN_SIZE / 2, COIN_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class FlyingEnemy extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.amplitude = 100;
        this.frequency = 0.005;
        this.startY = y;
        this.health = 3;
    }

    update() {
        this.x += this.velocityX;
        this.y = this.startY + Math.sin(Date.now() * this.frequency) * this.amplitude;

        if (this.x <= 0 || this.x + this.width >= CANVAS_WIDTH) {
            this.velocityX *= -1;
        }
    }

    draw() {
        const healthColors = ['#660000', '#990000', '#CC0000', '#9933FF'];
        ctx.fillStyle = healthColors[this.health];
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.beginPath();
        ctx.moveTo(this.x - 10, this.y + this.height / 2);
        ctx.lineTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width + 10, this.y + this.height / 2);
        ctx.strokeStyle = healthColors[this.health];
        ctx.stroke();
    }
}

class BossEnemy extends Enemy {
    constructor() {
        super(CANVAS_WIDTH / 2 - 50, 100);
        this.width = 80;
        this.height = 80;
        this.attackTimer = 0;
        this.attackInterval = 120;
        this.projectiles = [];
        this.health = 10;
    }

    update() {
        super.update();
        this.attackTimer++;

        if (this.attackTimer >= this.attackInterval) {
            this.attack();
            this.attackTimer = 0;
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            this.projectiles[i].update();
            if (this.projectiles[i].isOffscreen()) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    attack() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.projectiles.push(new Projectile(
            this.x + this.width / 2,
            this.y + this.height / 2,
            Math.cos(angle) * 5,
            Math.sin(angle) * 5
        ));
    }

    draw() {
        const healthColors = ['#660000', '#990000', '#CC0000', '#FF0000',
            '#FF3333', '#FF6666', '#FF9999', '#FFCCCC',
            '#FFE6E6', '#FFFFFF'];
        ctx.fillStyle = healthColors[Math.max(0, 10 - this.health)];
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.beginPath();
        ctx.moveTo(this.x + 10, this.y);
        ctx.lineTo(this.x + this.width - 10, this.y);
        ctx.lineTo(this.x + this.width / 2, this.y - 20);
        ctx.closePath();
        ctx.fillStyle = '#FFD700';
        ctx.fill();

        for (let projectile of this.projectiles) {
            projectile.draw();
        }
    }

    takeDamage(amount) {
        bossHealth -= amount;
        if (bossHealth <= 0) {
            unlockAchievement('Boss Slayer', 'Defeated the level boss!');
            nextLevel();
        }
    }
}

class Projectile {
    constructor(x, y, velocityX, velocityY) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
    }

    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#FF0000';
        ctx.fill();
    }

    isOffscreen() {
        return this.x < 0 || this.x > CANVAS_WIDTH ||
            this.y < 0 || this.y > CANVAS_HEIGHT;
    }
}

class Key {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 30;
        this.collected = false;
        this.floatOffset = 0;
    }

    update() {
        this.floatOffset = Math.sin(Date.now() / 500) * 5;
    }

    draw() {
        if (!this.collected) {
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(this.x, this.y + this.floatOffset, 15, 20);
            ctx.beginPath();
            ctx.arc(this.x + 7.5, this.y + this.floatOffset, 7, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.type = type;
        this.collected = false;
        this.floatOffset = 0;
    }

    update() {
        this.floatOffset = Math.sin(Date.now() / 500) * 5;
    }

    draw() {
        if (!this.collected) {
            ctx.fillStyle = this.type === 'speed' ? '#00FF00' : '#0000FF';
            ctx.fillRect(this.x, this.y + this.floatOffset, this.width, this.height);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                this.type === 'speed' ? '⚡' : '💪',
                this.x + this.width / 2,
                this.y + this.height / 2 + this.floatOffset
            );
        }
    }
}

class Particle {
    constructor(x, y, color = '#FFD700') {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 5 + 2;
        this.velocityX = (Math.random() - 0.5) * 8;
        this.velocityY = (Math.random() - 0.5) * 8;
        this.alpha = 1;
        this.gravity = 0.2;
    }

    update() {
        this.velocityY += this.gravity;
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.alpha -= 0.02;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class MovingPlatform extends Platform {
    constructor(x, y, width, range, speed) {
        super(x, y, width);
        this.startX = x;
        this.range = range;
        this.speed = speed;
        this.direction = 1;
    }

    update() {
        this.x += this.speed * this.direction;

        if (Math.abs(this.x - this.startX) > this.range) {
            this.direction *= -1;
        }

        if (player.isColliding(this) && player.velocityY >= 0) {
            const playerMovingRight = player.velocityX > 0;
            const playerMovingLeft = player.velocityX < 0;
            const platformMovingRight = this.direction > 0;

            if ((!playerMovingLeft && platformMovingRight) ||
                (!playerMovingRight && !platformMovingRight)) {
                player.x += this.speed * this.direction;
            }
        }
    }

    draw() {
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(this.startX, this.y + this.height / 2);
        ctx.lineTo(this.startX + this.range, this.y + this.height / 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

class EnhancedPlayer extends Player {
    constructor() {
        super();
        this.doubleJumpAvailable = false;
        this.hasShield = false;
        this.attackCooldown = 0;
        this.resetDoubleJump();
        this.powerUps = new Set();
    }

    resetDoubleJump() {
        this.doubleJumpAvailable = false;
        this.hasDoubleJump = false;
    }

    update() {
        super.update();

        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        }

        if (!this.isJumping) {
            this.doubleJumpAvailable = true;
        }

        if (this.isInvulnerable) {
            this.invulnerableTimer++;
            if (this.invulnerableTimer > 60) {
                this.isInvulnerable = false;
                this.invulnerableTimer = 0;
            }
        }
    }

    jump() {
        if (!this.isJumping) {
            this.velocityY = JUMP_FORCE;
            this.isJumping = true;
            createParticles(this.x + this.width / 2, this.y + this.height, 5);
        } else if (this.hasDoubleJump && this.doubleJumpAvailable) {
            this.velocityY = JUMP_FORCE * 0.8;
            this.doubleJumpAvailable = false;
            createParticles(this.x + this.width / 2, this.y + this.height, 8, '#00FF00');
        }
    }

    attack() {
        if (this.attackCooldown <= 0) {
            let direction;
            if (this.velocityX > 0) direction = 'right';
            else if (this.velocityX < 0) direction = 'left';
            else if (this.velocityY < 0) direction = 'up';
            else if (this.velocityY > 0) direction = 'down';
            else direction = this.lastDirection || 'right';

            this.lastDirection = direction;
            const ATTACK_RANGE = 60;
            let hitbox = {
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height
            };

            switch (direction) {
                case 'right':
                    hitbox.x = this.x + this.width;
                    hitbox.width = ATTACK_RANGE;
                    break;
                case 'left':
                    hitbox.x = this.x - ATTACK_RANGE;
                    hitbox.width = ATTACK_RANGE;
                    break;
                case 'up':
                    hitbox.y = this.y - ATTACK_RANGE;
                    hitbox.height = ATTACK_RANGE;
                    break;
                case 'down':
                    hitbox.y = this.y + this.height;
                    hitbox.height = ATTACK_RANGE;
                    break;
            }

            for (let enemy of enemies) {
                if (
                    hitbox.x < enemy.x + enemy.width &&
                    hitbox.x + hitbox.width > enemy.x &&
                    hitbox.y < enemy.y + enemy.height &&
                    hitbox.y + hitbox.height > enemy.y
                ) {
                    if (enemy instanceof BossEnemy) {
                        enemy.takeDamage(10);
                        createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 15, '#FF0000');
                    } else {
                        enemy.health--;
                        enemy.velocityX *= -1;
                        createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 10, '#FF0000');

                        if (enemy.health <= 0) {
                            enemies = enemies.filter(e => e !== enemy);
                            score += enemy instanceof FlyingEnemy ? 30 : 10;
                            updateScore();
                        }
                    }
                }
            }

            const particleCount = 12;
            switch (direction) {
                case 'right':
                    for (let i = 0; i < particleCount; i++) {
                        createParticles(
                            this.x + this.width + Math.random() * ATTACK_RANGE,
                            this.y + Math.random() * this.height,
                            3,
                            '#FFFFFF'
                        );
                    }
                    break;
                case 'left':
                    for (let i = 0; i < particleCount; i++) {
                        createParticles(
                            this.x - Math.random() * ATTACK_RANGE,
                            this.y + Math.random() * this.height,
                            3,
                            '#FFFFFF'
                        );
                    }
                    break;
                case 'up':
                    for (let i = 0; i < particleCount; i++) {
                        createParticles(
                            this.x + Math.random() * this.width,
                            this.y - Math.random() * ATTACK_RANGE,
                            3,
                            '#FFFFFF'
                        );
                    }
                    break;
                case 'down':
                    for (let i = 0; i < particleCount; i++) {
                        createParticles(
                            this.x + Math.random() * this.width,
                            this.y + this.height + Math.random() * ATTACK_RANGE,
                            3,
                            '#FFFFFF'
                        );
                    }
                    break;
            }

            this.attackCooldown = 20;
        }
    }
    takeDamage(amount) {
        if (this.hasShield) {
            this.hasShield = false;
            createParticles(this.x + this.width / 2, this.y + this.height / 2, 15, '#0000FF');
            return;
        }

        if (!this.isInvulnerable) {
            this.health -= amount;
            this.isInvulnerable = true;
            this.resetDoubleJump();
            createParticles(this.x + this.width / 2, this.y + this.height / 2, 10, '#FF0000');

            if (this.health <= 0) {
                gameOver();
            }
        }
    }

    draw() {
        if (!this.isInvulnerable || Math.floor(Date.now() / 100) % 2) {
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(this.x, this.y, this.width, this.height);

            ctx.fillStyle = '#000000';
            ctx.fillRect(this.x + 10, this.y + 10, 5, 5);
            ctx.fillRect(this.x + 25, this.y + 10, 5, 5);

            ctx.beginPath();
            if (this.health > 70) {
                ctx.arc(this.x + 20, this.y + 25, 5, 0, Math.PI, false);
            } else if (this.health > 30) {
                ctx.moveTo(this.x + 15, this.y + 25);
                ctx.lineTo(this.x + 25, this.y + 25);
            } else {
                ctx.arc(this.x + 20, this.y + 30, 5, Math.PI, 0, false)
            }
            ctx.stroke();

            if (this.hasShield) {
                ctx.strokeStyle = '#0000FF';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x + this.width / 2, this.y + this.height / 2,
                    this.width * 0.7, 0, Math.PI * 2);
                ctx.stroke();
                ctx.lineWidth = 1;
            }
        }
    }
}

function createParticles(x, y, amount, color) {
    for (let i = 0; i < amount; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function unlockAchievement(title, description) {
    if (!achievements.includes(title)) {
        achievements.push(title);
        showAchievementPopup(title, description);
        updateAchievementsDisplay();
    }
}

function showAchievementPopup(title, description) {
    const popup = document.getElementById('achievementPopup');
    popup.innerHTML = `
        <h3>Achievement Unlocked!</h3>
        <p>${title}</p>
        <p>${description}</p>
    `;
    popup.style.display = 'block';
    setTimeout(() => {
        popup.style.display = 'none';
    }, 3000);
}

function updateAchievementsDisplay() {
    const display = document.getElementById('achievements');
    display.innerHTML = `Achievements: ${achievements.length}`;
}

function nextLevel() {
    powerUpTimeouts.forEach(timeout => clearTimeout(timeout));
    powerUpTimeouts = [];

    currentLevel++;
    if (currentLevel > TOTAL_LEVELS) {
        gameWin();
        return;
    }

    player.health = 100;
    bossHealth = BOSS_HEALTH;
    collectedKeys = 0;
    isLevelTransitioning = false;

    document.getElementById('levelIndicator').textContent = `Level ${currentLevel}`;

    const slots = document.querySelectorAll('.inventory-slot');
    slots.forEach(slot => {
        while (slot.firstChild) {
            slot.removeChild(slot.firstChild);
        }
    });

    generateLevel(currentLevel);

    showLevelMessage(`Level ${currentLevel} Start!`);
}

function showLevelMessage(message) {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        z-index: 1000;
        font-family: 'Press Start 2P', cursive;
        animation: fadeInOut 2s ease-in-out;
    `;
    popup.innerHTML = message;
    document.getElementById('gameContainer').appendChild(popup);

    setTimeout(() => {
        popup.remove();
    }, 2000);
}

function generateLevel(level) {
    platforms.length = 0;
    enemies.length = 0;
    coins.length = 0;
    powerUps.length = 0;
    keys.length = 0;
    particles.length = 0;

    platforms.push(new Platform(0, CANVAS_HEIGHT - PLATFORM_HEIGHT, CANVAS_WIDTH));

    switch (level) {
        case 1:
            generateTutorialLevel();
            break;
        case 2:
            generateFlyingEnemiesLevel();
            break;
        case 3:
            generateMazeLevel();
            break;
        case 4:
            generateChallengeLevel();
            break;
        case 5:
            generateBossLevel();
            break;
    }

    player.x = CANVAS_WIDTH / 4;
    player.y = CANVAS_HEIGHT - player.height - PLATFORM_HEIGHT - 10;
    player.velocityX = 0;
    player.velocityY = 0;
}

function generateTutorialLevel() {
    platforms.push(
        new Platform(100, CANVAS_HEIGHT - 150, 200),
        new Platform(400, CANVAS_HEIGHT - 200, 200)
    );

    enemies.push(
        new Enemy(300, 0),
        new Enemy(500, 0)
    );

    addCoins(5);
    powerUps.push(new PowerUp(200, CANVAS_HEIGHT - 200, 'doubleJump'));
}

function generateFlyingEnemiesLevel() {
    platforms.push(
        new Platform(100, CANVAS_HEIGHT - 200, 150),
        new Platform(350, CANVAS_HEIGHT - 300, 150),
        new Platform(600, CANVAS_HEIGHT - 200, 150)
    );

    enemies.push(
        new FlyingEnemy(200, 200),
        new FlyingEnemy(400, 300),
        new FlyingEnemy(600, 250)
    );

    addCoins(8);
    powerUps.push(new PowerUp(400, CANVAS_HEIGHT - 350, 'shield'));
}

function generateMazeLevel() {
    const platformWidth = 100;
    for (let i = 0; i < 8; i++) {
        platforms.push(
            new Platform(
                i * platformWidth,
                CANVAS_HEIGHT - 150 - (i % 2) * 100,
                platformWidth - 20
            )
        );
    }

    enemies.push(
        new Enemy(200, 0),
        new FlyingEnemy(400, 200),
        new Enemy(600, 0)
    );

    addCoins(12);
    powerUps.push(
        new PowerUp(300, CANVAS_HEIGHT - 400, 'speed'),
        new PowerUp(500, CANVAS_HEIGHT - 300, 'strength')
    );

    addKeys(3);
}

function generateChallengeLevel() {
    platforms = platforms.concat(createMovingPlatforms());

    enemies.push(
        new FlyingEnemy(200, 150),
        new FlyingEnemy(400, 250),
        new Enemy(300, 0),
        new Enemy(500, 0)
    );

    addCoins(15);
    powerUps.push(
        new PowerUp(200, CANVAS_HEIGHT - 300, 'doubleJump'),
        new PowerUp(600, CANVAS_HEIGHT - 400, 'shield')
    );
}

function generateBossLevel() {
    platforms.push(
        new Platform(200, CANVAS_HEIGHT - 200, 400),
        new Platform(100, CANVAS_HEIGHT - 350, 200),
        new Platform(500, CANVAS_HEIGHT - 350, 200)
    );

    enemies.push(new BossEnemy());

    powerUps.push(
        new PowerUp(100, CANVAS_HEIGHT - 400, 'shield'),
        new PowerUp(700, CANVAS_HEIGHT - 400, 'strength')
    );
}

function createMovingPlatforms() {
    return [
        new MovingPlatform(100, CANVAS_HEIGHT - 200, 100, 200, 2),
        new MovingPlatform(400, CANVAS_HEIGHT - 300, 100, 150, 3),
        new MovingPlatform(600, CANVAS_HEIGHT - 400, 100, 100, 4)
    ];
}

function addCoins(amount) {
    for (let i = 0; i < amount; i++) {
        let x, y;
        do {
            x = Math.random() * (CANVAS_WIDTH - COIN_SIZE);
            y = Math.random() * (CANVAS_HEIGHT - COIN_SIZE - 100);
        } while (!isValidPosition(x, y));

        coins.push(new Coin(x, y));
    }
}

function addKeys(amount) {
    for (let i = 0; i < amount; i++) {
        let x = 100 + i * 200;
        let y = CANVAS_HEIGHT - 300;
        keys.push(new Key(x, y));
    }
}

function isValidPosition(x, y) {
    for (let platform of platforms) {
        if (x < platform.x + platform.width &&
            x + COIN_SIZE > platform.x &&
            y < platform.y + platform.height &&
            y + COIN_SIZE > platform.y) {
            return false;
        }
    }
    return true;
}

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    player = new EnhancedPlayer();
    generateLevel(1);
    setupControls();
    gameLoop = setInterval(update, 1000 / 60);
}

function getLevelTarget(level) {
    const incrementalTargets = [50, 50, 100, 150, 200];
    return incrementalTargets[level - 1];
}

function handleLevelCompletion() {
    if (!isLevelTransitioning) {
        const currentLevelScore = score - previousLevelMaxScore;
        const levelTarget = getLevelTarget(currentLevel);

        if (currentLevelScore >= levelTarget) {
            isLevelTransitioning = true;
            previousLevelMaxScore = score;

            const popup = document.createElement('div');
            popup.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                z-index: 1000;
                font-family: 'Press Start 2P', cursive;
            `;

            const stars = Math.ceil((currentLevelScore / levelTarget) * 3);
            const starsDisplay = '⭐'.repeat(stars);

            popup.innerHTML = `
                <h2>Level ${currentLevel} Complete!</h2>
                <p>Level Score: ${currentLevelScore}</p>
                <p>Total Score: ${score}</p>
                <p>${starsDisplay}</p>
                <p>Next Level Starting...</p>
            `;

            document.getElementById('gameContainer').appendChild(popup);

            for (let i = 0; i < 30; i++) {
                setTimeout(() => {
                    createParticles(
                        Math.random() * CANVAS_WIDTH,
                        Math.random() * CANVAS_HEIGHT,
                        5,
                        `hsl(${Math.random() * 360}, 100%, 50%)`
                    );
                }, i * 100);
            }

            setTimeout(() => {
                popup.remove();
                nextLevel();
            }, 2000);
        }
    }
}

function update() {
    if (isGameOver) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (let platform of platforms) {
        if (platform instanceof MovingPlatform) {
            platform.update();
        }
    }

    for (let key of keys) {
        if (!key.collected && player.isColliding(key)) {
            key.collected = true;
            collectedKeys++;
            createParticles(key.x + key.width / 2, key.y + key.height / 2, 10, '#FFD700');

            if (collectedKeys >= requiredKeys) {
                unlockAchievement('Key Master', 'Collected all keys in a level!');
                nextLevel();
            }
        }
    }

    player.update();

    for (let enemy of enemies) {
        enemy.update();
        if (player.isColliding(enemy)) {
            if (player.velocityY > 0 &&
                player.y + player.height <= enemy.y + enemy.height / 2) {
                enemy.health--;
                createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 10, '#FF0000');
                player.velocityY = JUMP_FORCE / 2;

                if (enemy.health <= 0) {
                    enemies = enemies.filter(e => e !== enemy);
                    if (enemy instanceof BossEnemy) {
                        score += 500;
                    } else if (enemy instanceof FlyingEnemy) {
                        score += 30;
                    } else {
                        score += 10;
                    }
                    updateScore();
                    handleLevelCompletion();
                }
            } else {
                player.takeDamage(20);
            }
        }
    }

    for (let coin of coins) {
        if (!coin.collected && player.isColliding(coin)) {
            coin.collected = true;
            score += 10;
            createParticles(coin.x + COIN_SIZE / 2, coin.y + COIN_SIZE / 2, 10);
            updateScore();
            handleLevelCompletion();
        }
    }

    for (let powerUp of powerUps) {
        if (!powerUp.collected && player.isColliding(powerUp)) {
            powerUp.collected = true;
            applyPowerUp(powerUp.type);
            createParticles(
                powerUp.x + powerUp.width / 2,
                powerUp.y + powerUp.height / 2,
                15,
                powerUp.type === 'speed' ? '#00FF00' : '#0000FF'
            );
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].alpha <= 0) {
            particles.splice(i, 1);
        }
    }

    drawGame();
    document.getElementById('health').textContent = `Health: ${player.health}`;
}

function drawGame() {
    drawBackground();

    for (let platform of platforms) {
        platform.draw();
    }

    for (let coin of coins) {
        coin.draw();
    }

    for (let enemy of enemies) {
        enemy.draw();
    }

    for (let powerUp of powerUps) {
        powerUp.update();
        powerUp.draw();
    }

    for (let particle of particles) {
        particle.draw();
    }

    for (let key of keys) {
        key.update();
        key.draw();
    }

    player.draw();
}

function drawBackground() {
    let gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 5; i++) {
        drawCloud(100 + i * 200, 100 + Math.sin(Date.now() / 1000 + i) * 20);
    }
}

function drawCloud(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.arc(x + 15, y - 10, 15, 0, Math.PI * 2);
    ctx.arc(x + 25, y + 5, 18, 0, Math.PI * 2);
    ctx.arc(x + 40, y, 15, 0, Math.PI * 2);
    ctx.fill();
}

function updateScore() {
    document.getElementById('score').textContent = `Score: ${score}`;
}

function gameOver() {
    isGameOver = true;
    clearInterval(gameLoop);
    document.getElementById('gameOver').style.display = 'block';
    document.getElementById('finalScore').textContent = `Final Score: ${score}`;
}

function gameWin() {
    isGameOver = true;
    clearInterval(gameLoop);

    const gameOver = document.getElementById('gameOver');
    gameOver.innerHTML = `
        <h2>Congratulations!</h2>
        <p>You've completed all levels!</p>
        <p>Final Score: ${score}</p>
        <p>Achievements: ${achievements.length}</p>
        <button onclick="restartGame()">Play Again</button>
    `;
    gameOver.style.display = 'block';

    unlockAchievement('Game Master', 'Completed all levels!');
}

function restartGame() {
    window.location.reload();
}

function setupControls() {
    const attackBtn = document.getElementById('attackBtn');
    attackBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        player.attack();
    });
    attackBtn.addEventListener('mousedown', () => player.attack());

    document.addEventListener('keydown', (e) => {
        if (isGameOver) return;

        switch (e.key) {
            case 'ArrowLeft':
                player.velocityX = -MOVEMENT_SPEED;
                break;
            case 'ArrowRight':
                player.velocityX = MOVEMENT_SPEED;
                break;
            case 'ArrowUp':
            case ' ':
                player.jump();
                break;
            case 'x':
            case 'X':
                player.attack();
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (isGameOver) return;

        switch (e.key) {
            case 'ArrowLeft':
                if (player.velocityX < 0) player.velocityX = 0;
                break;
            case 'ArrowRight':
                if (player.velocityX > 0) player.velocityX = 0;
                break;
        }
    });

    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const jumpBtn = document.getElementById('jumpBtn');

    function handleTouchStart(direction) {
        if (isGameOver) return;
        if (direction === 'left') player.velocityX = -MOVEMENT_SPEED;
        else if (direction === 'right') player.velocityX = MOVEMENT_SPEED;
        else if (direction === 'jump') player.jump();
    }

    function handleTouchEnd(direction) {
        if (isGameOver) return;
        if ((direction === 'left' && player.velocityX < 0) ||
            (direction === 'right' && player.velocityX > 0)) {
            player.velocityX = 0;
        }
    }

    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleTouchStart('left');
    });

    leftBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleTouchEnd('left');
    });

    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleTouchStart('right');
    });

    rightBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleTouchEnd('right');
    });

    jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleTouchStart('jump');
    });

    leftBtn.addEventListener('mousedown', () => handleTouchStart('left'));
    leftBtn.addEventListener('mouseup', () => handleTouchEnd('left'));
    rightBtn.addEventListener('mousedown', () => handleTouchStart('right'));
    rightBtn.addEventListener('mouseup', () => handleTouchEnd('right'));
    jumpBtn.addEventListener('mousedown', () => handleTouchStart('jump'));
}

function showPowerUpMessage(message) {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: absolute;
        top: 20%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        font-size: 18px;
        text-align: center;
        z-index: 1000;
        animation: fadeInOut 3s ease-in-out;
    `;
    popup.innerHTML = message;
    document.getElementById('gameContainer').appendChild(popup);

    setTimeout(() => {
        popup.remove();
    }, 3000);
}

function applyPowerUp(type) {
    let message = '';

    switch (type) {
        case 'speed':
            const originalSpeed = MOVEMENT_SPEED;
            player.velocityX *= 1.5;
            message = '⚡ Speed Boost: Move 50% faster for 5 seconds!';
            const speedTimeout = setTimeout(() => {
                if (!isGameOver) {
                    player.velocityX = Math.sign(player.velocityX) * originalSpeed;
                    showPowerUpMessage('Speed boost expired!');
                }
            }, 5000);
            powerUpTimeouts.push(speedTimeout);
            break;

        case 'strength':
            player.isInvulnerable = true;
            message = '💪 Invincibility: Immune to damage for 3 seconds!';
            const strengthTimeout = setTimeout(() => {
                if (!isGameOver) {
                    player.isInvulnerable = false;
                    showPowerUpMessage('Invincibility expired!');
                }
            }, 3000);
            powerUpTimeouts.push(strengthTimeout);
            break;

        case 'doubleJump':
            player.hasDoubleJump = true;
            message = '🦘 Double Jump Unlocked: Press jump again in mid-air!';
            unlockAchievement('High Flyer', 'Acquired the double jump ability!');
            break;

        case 'shield':
            player.hasShield = true;
            message = '🛡️ Shield Active: Blocks the next hit!';
            unlockAchievement('Protected', 'Acquired a protective shield!');
            break;
    }

    const particleColor = type === 'speed' ? '#00FF00' :
        type === 'strength' ? '#FF0000' :
            type === 'doubleJump' ? '#FFFF00' : '#0000FF';

    createParticles(
        player.x + player.width / 2,
        player.y + player.height / 2,
        20,
        particleColor
    );
    showPowerUpMessage(message);
    updatePowerUpUI(type);
}

function updatePowerUpUI(type) {
    const slots = document.querySelectorAll('.inventory-slot');
    for (let slot of slots) {
        if (!slot.hasChildNodes()) {
            const icon = document.createElement('div');
            icon.style.cssText = `
                width: 30px;
                height: 30px;
                background-color: ${type === 'speed' ? '#00FF00' :
                    type === 'strength' ? '#FF0000' :
                        type === 'doubleJump' ? '#FFFF00' : '#0000FF'
                };
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 20px;
            `;
            icon.innerHTML =
                type === 'speed' ? '⚡' :
                    type === 'strength' ? '💪' :
                        type === 'doubleJump' ? '🦘' : '🛡️';

            slot.appendChild(icon);

            if (type === 'speed' || type === 'strength') {
                setTimeout(() => {
                    icon.remove();
                }, type === 'speed' ? 5000 : 3000);
            }
            break;
        }
    }
}

window.addEventListener('resize', () => {
    const container = document.getElementById('gameContainer');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const scale = Math.min(
        containerWidth / CANVAS_WIDTH,
        containerHeight / CANVAS_HEIGHT
    );

    canvas.style.width = `${CANVAS_WIDTH * scale}px`;
    canvas.style.height = `${CANVAS_HEIGHT * scale}px`;
});

window.onload = () => {
    if (!localStorage.getItem('tour')) {
        localStorage.setItem('tour', true);
        document.getElementById('tutorialOverlay').style.display = 'flex';
    } else {
        startGame();
    }
}