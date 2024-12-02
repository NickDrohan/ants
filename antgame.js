const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions
canvas.width = 800; // Set your desired canvas width
canvas.height = 600; // Set your desired canvas height

// Map configuration
const cellSize = 10; // Size of each cell in pixels
const cols = Math.floor(canvas.width / cellSize);
const rows = Math.floor(canvas.height / cellSize);
const map = [];

// Define grid properties for spatial partitioning
const GRID_CELL_SIZE = 50;
const gridCols = Math.ceil(canvas.width / GRID_CELL_SIZE);
const gridRows = Math.ceil(canvas.height / GRID_CELL_SIZE);

// Initialize the spatial grid
const spatialGrid = [];
for (let y = 0; y < gridRows; y++) {
    spatialGrid[y] = [];
    for (let x = 0; x < gridCols; x++) {
        spatialGrid[y][x] = {
            ants: [],
            pheromones: []
        };
    }
}

// Initialize the map
function initializeMap() {
    // Create empty map
    for (let y = 0; y < rows; y++) {
        map[y] = [];
        for (let x = 0; x < cols; x++) {
            map[y][x] = 0; // 0 for white space (passable)
        }
    }

    // Create border walls
    for (let x = 0; x < cols; x++) {
        map[0][x] = 1; // Top wall
        map[rows - 1][x] = 1; // Bottom wall
    }
    for (let y = 0; y < rows; y++) {
        map[y][0] = 1; // Left wall
        map[y][cols - 1] = 1; // Right wall
    }

    // Create some random internal walls
    for (let i = 0; i < 50; i++) {
        const x = Math.floor(Math.random() * (cols - 2)) + 1;
        const y = Math.floor(Math.random() * (rows - 2)) + 1;
        createRandomWall(x, y);
    }

}

// Create a random wall shape
function createRandomWall(startX, startY) {
    const length = Math.floor(Math.random() * 5) + 3;
    const direction = Math.floor(Math.random() * 4); // 0: right, 1: down, 2: left, 3: up
    
    for (let i = 0; i < length; i++) {
        let x = startX;
        let y = startY;
        
        switch(direction) {
            case 0: x += i; break;
            case 1: y += i; break;
            case 2: x -= i; break;
            case 3: y -= i; break;
        }
        
        if (x > 0 && x < cols - 1 && y > 0 && y < rows - 1) {
            map[y][x] = 1;
        }
    }
}

// Draw the map
function drawMap() {
    ctx.fillStyle = '#FFFFFF'; // White background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#000000'; // Black walls
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (map[y][x] === 1) {
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }
}

// Initialize and draw
initializeMap();
drawMap();

// Function to check if a position is walkable (returns true if white space)
function isWalkable(x, y) {
    const gridX = Math.floor(x / cellSize);
    const gridY = Math.floor(y / cellSize);
    return gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows && map[gridY][gridX] === 0;
}

// Add at the top with other constants
const antImage = new Image();
antImage.src = './ants/Ant.png';

// Add these constants at the top with the others
const ANT_SPEED = 0.5; // reduced from 1 to 0.5 pixels per frame
const ROTATION_SPEED = 0.1; // radians per frame
const NEST_RADIUS = 30;
const NEST_COLOR = '#ADD8E6'; // light blue

// Add these constants at the top
const PHEROMONE_LIFETIME = 300; // How long pheromones last (in frames)
const PHEROMONE_SIZE = 3; // Size of pheromone dots
const PHEROMONE_INTERVAL = 5; // How often ants drop pheromones (in frames)

// Add these constants at the top with the others
const FOOD_SENSE_RADIUS = 50; // How far ants can sense food
const FOOD_ATTRACTION_STRENGTH = 1.0; // Increased from 0.5
const NEST_RETURN_STRENGTH = 0.3; // Doubled from 0.15

// Add these constants at the top
const FOOD_PICKUP_DISTANCE = cellSize; // Distance at which ants can pick up food

// Add these constants at the top
const MAX_TURN_RATE = 0.2; // Doubled from 0.1 to 0.2 radians per frame
const WALL_SENSOR_DISTANCE = cellSize * 8; // Much longer distance to check for walls
const WALL_SENSOR_ANGLES = [
    -0.8, -0.4, // Left side sensors
    -0.52, // Left diagonal path check (30 degrees)
    0, // Center
    0.52,  // Right diagonal path check (30 degrees)
    0.4, 0.8 // Right side sensors
];

// Add these constants for pheromone types
const PHEROMONE_TYPES = {
    SEEKING: {
        color: 'rgba(200, 0, 200, ', // Purple for seeking food
        lifetime: 300
    },
    RETURNING: {
        color: 'rgba(0, 200, 0, ',  // Green for returning with food
        lifetime: 400  // Slightly longer lifetime for return path
    }
};

// Add Pheromone class
class Pheromone {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.lifetime = PHEROMONE_TYPES[type].lifetime;
        this.initialLifetime = PHEROMONE_TYPES[type].lifetime;
        this.size = PHEROMONE_SIZE;
        // Grid properties
        this.gridX = Math.floor(this.x / GRID_CELL_SIZE);
        this.gridY = Math.floor(this.y / GRID_CELL_SIZE);
        addToCell(this, this.gridX, this.gridY, 'pheromones');
    }

    draw() {
        const lifeRatio = this.lifetime / this.initialLifetime;
        const alpha = Math.max(0, lifeRatio);
        const size = this.size * lifeRatio;
        ctx.beginPath();
        ctx.fillStyle = PHEROMONE_TYPES[this.type].color + alpha + ')';
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        this.lifetime--;
        if (this.lifetime <= 0) {
            removeFromCell(this, this.gridX, this.gridY, 'pheromones');
            pheromonePool.push(this);
            return false;
        }
        return true;
    }

    reset(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.lifetime = PHEROMONE_TYPES[type].lifetime;
        this.initialLifetime = PHEROMONE_TYPES[type].lifetime;
        // Recalculate grid position
        this.gridX = Math.floor(this.x / GRID_CELL_SIZE);
        this.gridY = Math.floor(this.y / GRID_CELL_SIZE);
        addToCell(this, this.gridX, this.gridY, 'pheromones');
    }
}

// Add pheromones array with other constants
const pheromones = [];

// Add Nest class after the Ant class
class Nest {
    constructor() {
        // Find a good position for the nest (away from walls)
        let position;
        do {
            position = findEmptyPosition();
            // Check if there's enough space for the nest circle
            let hasSpace = true;
            for (let dx = -NEST_RADIUS; dx <= NEST_RADIUS; dx++) {
                for (let dy = -NEST_RADIUS; dy <= NEST_RADIUS; dy++) {
                    if (dx * dx + dy * dy <= NEST_RADIUS * NEST_RADIUS) {
                        if (!isWalkable(position.x + dx, position.y + dy)) {
                            hasSpace = false;
                            break;
                        }
                    }
                }
                if (!hasSpace) break;
            }
            if (hasSpace) break;
        } while (true);

        this.x = position.x;
        this.y = position.y;
        this.radius = NEST_RADIUS;
    }

    draw() {
        ctx.beginPath();
        ctx.fillStyle = NEST_COLOR;
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    getRandomPosition() {
        // Get random position within the nest
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * this.radius;
        return {
            x: this.x + Math.cos(angle) * distance,
            y: this.y + Math.sin(angle) * distance
        };
    }
}

// Add nest variable with other constants
const nest = new Nest();

// Add Ant class
class Ant {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = cellSize;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = ANT_SPEED;
        this.pheromoneTimer = 0;
        this.carryingFood = null; // Reference to the food being carried
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.size/2, this.y + this.size/2);
        ctx.rotate(this.angle + Math.PI/2);
        ctx.drawImage(antImage, -this.size/2, -this.size/2, this.size, this.size);
        
        // Draw carried food if any
        if (this.carryingFood) {
            ctx.translate(0, -this.size/2); // Position food above ant
            ctx.fillStyle = FOOD_COLOR;
            ctx.beginPath();
            ctx.arc(0, 0, this.size/3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    move() {
        let nearestFood = null;
        let nearestDist = FOOD_SENSE_RADIUS;
        let desiredAngle = this.angle;
        let followingPheromone = false;

        if (this.carryingFood) {
            // Existing nest return behavior
            const dx = nest.x - (this.x + this.size/2);
            const dy = nest.y - (this.y + this.size/2);
            const distToNest = Math.sqrt(dx * dx + dy * dy);
            
            if (distToNest < NEST_RADIUS) {
                this.carryingFood = null;
                return;
            }

            desiredAngle = Math.atan2(dy, dx);
        } else {
            // Check nearby pheromones when not carrying food
            let pheromoneInfluenceX = 0;
            let pheromoneInfluenceY = 0;

            // Get grid cells in range
            const gridX = Math.floor(this.x / GRID_CELL_SIZE);
            const gridY = Math.floor(this.y / GRID_CELL_SIZE);
            const cellRange = Math.ceil(PHEROMONE_ATTRACTION_RADIUS / GRID_CELL_SIZE);

            for (let dy = -cellRange; dy <= cellRange; dy++) {
                for (let dx = -cellRange; dx <= cellRange; dx++) {
                    const checkGridX = gridX + dx;
                    const checkGridY = gridY + dy;

                    if (checkGridX >= 0 && checkGridX < gridCols && 
                        checkGridY >= 0 && checkGridY < gridRows) {
                        
                        const cell = spatialGrid[checkGridY][checkGridX];
                        cell.pheromones.forEach(pheromone => {
                            const dx = pheromone.x - (this.x + this.size/2);
                            const dy = pheromone.y - (this.y + this.size/2);
                            const distance = Math.sqrt(dx * dx + dy * dy);

                            if (distance < PHEROMONE_ATTRACTION_RADIUS) {
                                const influence = 1 - (distance / PHEROMONE_ATTRACTION_RADIUS);
                                if (pheromone.type === 'RETURNING') {
                                    // Attract to return pheromones
                                    pheromoneInfluenceX += (dx / distance) * influence * RETURN_PHEROMONE_STRENGTH;
                                    pheromoneInfluenceY += (dy / distance) * influence * RETURN_PHEROMONE_STRENGTH;
                                } else {
                                    // Repel from seeking pheromones
                                    pheromoneInfluenceX -= (dx / distance) * influence * SEEK_PHEROMONE_REPULSION;
                                    pheromoneInfluenceY -= (dy / distance) * influence * SEEK_PHEROMONE_REPULSION;
                                }
                            }
                        });
                    }
                }
            }

            // Combine pheromone influence with food seeking
            if (Math.abs(pheromoneInfluenceX) > 0.001 || Math.abs(pheromoneInfluenceY) > 0.001) {
                const pheromoneAngle = Math.atan2(pheromoneInfluenceY, pheromoneInfluenceX);
                desiredAngle = pheromoneAngle;
                followingPheromone = true;
            }

            // Existing food seeking behavior
            foods.forEach(food => {
                const dx = food.x + food.size/2 - (this.x + this.size/2);
                const dy = food.y + food.size/2 - (this.y + this.size/2);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < nearestDist) {
                    nearestFood = food;
                    nearestDist = distance;
                }

                if (distance < FOOD_PICKUP_DISTANCE) {
                    const foodIndex = foods.indexOf(food);
                    if (foodIndex > -1) {
                        foods.splice(foodIndex, 1);
                        this.carryingFood = food;
                        return;
                    }
                }
            });

            // If food is found, override pheromone influence
            if (nearestFood && !this.carryingFood) {
                const dx = nearestFood.x + nearestFood.size/2 - (this.x + this.size/2);
                const dy = nearestFood.y + nearestFood.size/2 - (this.y + this.size/2);
                desiredAngle = Math.atan2(dy, dx);
                // Apply increased attraction strength
                this.angle += Math.sign(desiredAngle - this.angle) * FOOD_ATTRACTION_STRENGTH;
            } else if (!followingPheromone) {
                // Add random turn when not following pheromones or food
                desiredAngle += (Math.random() - 0.5) * RANDOM_TURN_FACTOR;
            }
        }

        // Wall avoidance using multiple sensors
        let wallAvoidanceAngle = null;
        let leftPathClear = false;
        let rightPathClear = false;

        // First check diagonal path sensors
        for (const sensorAngle of [-0.52, 0.52]) { // ±30 degrees in radians
            const checkAngle = this.angle + sensorAngle;
            if (!raycastWall(this.x + this.size/2, this.y + this.size/2, checkAngle, WALL_SENSOR_DISTANCE)) {
                if (sensorAngle < 0) leftPathClear = true;
                else rightPathClear = true;
            }
        }

        // Then check other sensors for immediate wall detection
        for (const sensorAngle of WALL_SENSOR_ANGLES) {
            const checkAngle = this.angle + sensorAngle;
            if (raycastWall(this.x + this.size/2, this.y + this.size/2, checkAngle, WALL_SENSOR_DISTANCE)) {
                // Wall detected, choose turn direction based on clear paths
                if (leftPathClear && !rightPathClear) {
                    wallAvoidanceAngle = this.angle - Math.PI/2; // Turn left
                } else if (!leftPathClear && rightPathClear) {
                    wallAvoidanceAngle = this.angle + Math.PI/2; // Turn right
                } else {
                    // If both paths are clear or both blocked, choose randomly
                    const turnDirection = Math.random() < 0.5 ? -1 : 1;
                    wallAvoidanceAngle = this.angle + (turnDirection * Math.PI/2);
                }
                break;
            }
        }

        // Determine final target angle
        const targetAngle = wallAvoidanceAngle || desiredAngle;

        // Smooth turning
        const angleDiff = targetAngle - this.angle;
        const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        
        // Apply turn rate limit
        const turnRate = this.carryingFood ? NEST_RETURN_STRENGTH : FOOD_ATTRACTION_STRENGTH;
        const maxTurn = Math.min(Math.abs(normalizedDiff), MAX_TURN_RATE);
        this.angle += Math.sign(normalizedDiff) * maxTurn * turnRate;

        // Always move forward at constant speed
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        // Ensure the ant stays within the canvas bounds
        this.x = Math.max(0, Math.min(this.x, canvas.width - this.size));
        this.y = Math.max(0, Math.min(this.y, canvas.height - this.size));

        // Update pheromone dropping to use different types
        this.pheromoneTimer++;
        if (this.pheromoneTimer >= PHEROMONE_INTERVAL) {
            const pheromoneType = this.carryingFood ? 'RETURNING' : 'SEEKING';
            getPheromone(
                this.x + this.size/2, 
                this.y + this.size/2, 
                pheromoneType
            );
            this.pheromoneTimer = 0;
        }
    }

    // Add this new method to the Ant class
    raycastFood(angle) {
        const maxDistance = Math.max(canvas.width, canvas.height); // Infinite distance
        const steps = 100; // Number of steps to check along the ray
        const stepSize = maxDistance / steps;

        for (let i = 1; i <= steps; i++) {
            const checkX = this.x + Math.cos(angle) * (stepSize * i);
            const checkY = this.y + Math.sin(angle) * (stepSize * i);

            for (const food of foods) {
                const foodCenterX = food.x + food.size / 2;
                const foodCenterY = food.y + food.size / 2;
                const distance = Math.sqrt((checkX - foodCenterX) ** 2 + (checkY - foodCenterY) ** 2);

                if (distance < food.size / 2) {
                    return food; // Food detected
                }
            }
        }
        return null; // No food detected
    }
}

const ants = [];
class Food {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = cellSize;
    }

    draw() {
        ctx.beginPath();
        ctx.fillStyle = 'yellow';
        ctx.arc(this.x + this.size/2, this.y + this.size/2, this.size/2, 0, Math.PI * 2);
        ctx.fill();
    }
}

const foods = [];

function spawnFood() {
    const x = Math.floor(Math.random() * cols) * cellSize;
    const y = Math.floor(Math.random() * rows) * cellSize;
    const food = new Food(x, y);
    foods.push(food);
}

document.getElementById('spawnFood').addEventListener('click', spawnFood);

class FoodSupply {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = NEST_RADIUS;
        this.color = '#FFA07A'; // Light orange
        this.foods = [];

        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * this.radius;
            const foodX = this.x + Math.cos(angle) * distance;
            const foodY = this.y + Math.sin(angle) * distance;
            const food = new Food(foodX, foodY);
            this.foods.push(food);
            foods.push(food); // Add food to the main foods array
        }
    }

    draw() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

const foodSupplies = [];

// Update the draw function to include the nest
function draw() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw map and nest
    drawMap();
    nest.draw();

    // Draw pheromones
    for (let y = 0; y < gridRows; y++) {
        for (let x = 0; x < gridCols; x++) {
            const cell = spatialGrid[y][x];
            cell.pheromones.forEach(pheromone => {
                pheromone.draw();
            });
        }
    }

    // Draw food supplies
    foodSupplies.forEach(foodSupply => {
        foodSupply.draw();
    });

    // Draw ants
    ants.forEach(ant => {
        ant.draw();
    });

    // Draw foods
    foods.forEach(food => {
        food.draw();
    });
}

// Update spawnAnt function to spawn from nest
function spawnAnt() {
    const pos = nest.getRandomPosition();
    const ant = new Ant(pos.x, pos.y);
    // Set random initial angle for ants leaving the nest
    ant.angle = Math.random() * Math.PI * 2;
    ants.push(ant);
}

// Update initialization
function init() {
    initializeMap();  // Set up the game map
    for (let i = 0; i < 2; i++) {
        const pos = findEmptyPosition();
        const foodSupply = new FoodSupply(pos.x, pos.y);
        foodSupplies.push(foodSupply);
    }
    draw();  // Draw the initial game state
    gameLoop();  // Start the game loop
}


// Update the game loop
function gameLoop() {
    // Update ants
    ants.forEach(ant => {
        ant.move();
    });

    // Update and clean up pheromones
    for (let i = pheromones.length - 1; i >= 0; i--) {
        if (!pheromones[i].update()) {
            // Remove from the array
            pheromones.splice(i, 1);
        }
    }
    document.getElementById('antCounter').innerText = ants.length;
    document.getElementById('foodCounter').innerText = foods.length;
    // Draw everything
    draw();

    requestAnimationFrame(gameLoop);
}

// Replace the old initialization with the new one
init();

// Keep the image loading code
antImage.onload = () => {
    draw();
};

// Add event listener for spawn button
document.getElementById('spawnAnt').addEventListener('click', spawnAnt);

// Remove the old findEmptyPosition function and replace with this updated version
function findEmptyPosition() {
    let x, y;
    const padding = NEST_RADIUS + cellSize; // Extra space to ensure nest fits
    do {
        x = Math.floor(Math.random() * (cols - 4) + 2) * cellSize;
        y = Math.floor(Math.random() * (rows - 4) + 2) * cellSize;
    } while (!isWalkable(x, y));
    return { x, y };
}

function getPheromone(x, y, type) {
    let pheromone;
    if (pheromonePool.length > 0) {
        pheromone = pheromonePool.pop();
        pheromone.reset(x, y, type);
    } else {
        pheromone = new Pheromone(x, y, type);
    }
    pheromones.push(pheromone);
    return pheromone;
}

function isInViewport(entity, viewport) {
    return (
        entity.x + entity.size >= viewport.x &&
        entity.x - entity.size <= viewport.x + viewport.width &&
        entity.y + entity.size >= viewport.y &&
        entity.y - entity.size <= viewport.y + viewport.height
    );
}

// Add this at the top with other global variables
const pheromonePool = [];

function addToCell(entity, gridX, gridY, type) {
    if (gridX >= 0 && gridX < gridCols && gridY >= 0 && gridY < gridRows) {
        spatialGrid[gridY][gridX][type].push(entity);
    }
}

function removeFromCell(entity, gridX, gridY, type) {
    if (gridX >= 0 && gridX < gridCols && gridY >= 0 && gridY < gridRows) {
        const index = spatialGrid[gridY][gridX][type].indexOf(entity);
        if (index > -1) {
            spatialGrid[gridY][gridX][type].splice(index, 1);
        }
    }
}

// Add this with the other constants at the top
const FOOD_COLOR = '#FFFF00'; // Yellow color for food items

// Add this helper function for raycasting
function raycastWall(x, y, angle, distance) {
    const steps = 8; // Increased number of points to check along the ray
    const stepSize = distance / steps;
    
    for (let i = 1; i <= steps; i++) {
        const checkX = x + Math.cos(angle) * (stepSize * i);
        const checkY = y + Math.sin(angle) * (stepSize * i);
        if (!isWalkable(checkX, checkY)) {
            return true; // Wall detected
        }
    }
    return false; // No wall detected
}

// Add these constants for pheromone influence
const PHEROMONE_ATTRACTION_RADIUS = 30; // How far ants can sense pheromones
const RETURN_PHEROMONE_STRENGTH = 0.15; // How strongly ants are attracted to return pheromones
const SEEK_PHEROMONE_REPULSION = 0.05; // How strongly ants are repelled from seeking pheromones

// Add this constant at the top with the other constants
const RANDOM_TURN_FACTOR = 0.2; // Maximum random turn in radians when wandering

// Find the constructor or initialization code
class AntGame {
    constructor() {
        // Add these properties if they don't exist
        this.foodCount = 0;
        this.antCount = 0;
        
        // Make sure we have the counter elements
        this.foodCounter = document.getElementById('foodCounter');
        this.antCounter = document.getElementById('antCounter');
    }

    // Find the method that updates the counters
    updateCounters() {
        // Update the display
        if (this.foodCounter) {
            this.foodCounter.textContent = this.foodCount;
        }
        if (this.antCounter) {
            this.antCounter.textContent = this.antCount;
        }
    }

    // In your food collection method
    collectFood() {
        // ... existing food collection logic ...
        this.foodCount++;
        this.updateCounters();
    }

    // In your ant spawning method
    spawnAnt() {
        // ... existing ant spawning logic ...
        this.antCount++;
        this.updateCounters();
    }
}
