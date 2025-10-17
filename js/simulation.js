// prettier-ignore
/* eslint-disable */
class RobotSimulation {
    constructor(config) {
        this.config = config;
        this.conveyorSystems = [];
        this.cabinets = [];
        this.workshop = document.getElementById('workshop');
        this.selectedTool = null;
        this.deleteMode = false;
        this.firstNodeForConnection = null;

        // Упрощенная система слоев
        this.layers = this.initializeLayers();
        this.currentLayerId = 'layer-0';
        this.layerCounter = 1;

        // Система времени
        this.timeSettings = {
            globalSpeed: 1,
            conveyorSpeed: 1,
            robotSpeed: 1,
            simulationRunning: false
        };

        // Статистика
        this.statistics = {
            cabinetsProduced: 0,
            robots: {}
        };

        this.init();
        this.initTimeControls();
    }

    initializeLayers() {
        return {
            'layer-0': {
                id: 'layer-0',
                name: 'Слой 1',
                visible: true,
                elements: {
                    robot: null,
                    warehouse: null,
                    conveyors: [],
                    posts: [],
                    pathNodes: [],
                    pathLines: []
                },
                simulation: {
                    running: false,
                    paused: false,
                    postsToVisit: [],
                    visitedPosts: 0,
                    totalPosts: 0
                }
            }
        };
    }

    initTimeControls() {
        // Создаем панель управления временем
        this.createTimeControlPanel();
    }

    createConveyorSystem(x, y, systemId, productionTime = 5400000) {
        const gridSize = this.config.workshop.scale;
        const conveyorLength = 12;

        const conveyorSystem = {
            id: systemId,
            segments: [],
            activeCabinet: null,
            lastCabinetTime: 0,
            cabinetInterval: productionTime / 6, // 6 шкафов за время производства
            productionTime: productionTime
        };

        // Создаем сегменты конвейера
        for (let i = 0; i < conveyorLength; i++) {
            const conveyor = document.createElement('div');
            conveyor.className = 'element conveyor conveyor-segment';
            conveyor.style.left = (x + i * gridSize) + 'px';
            conveyor.style.top = y + 'px';
            conveyor.style.width = gridSize + 'px';
            conveyor.style.height = gridSize + 'px';
            conveyor.dataset.system = systemId;
            conveyor.dataset.segment = i + 1;

            this.workshop.appendChild(conveyor);

            const segmentData = {
                element: conveyor,
                x: x + i * gridSize,
                y: y,
                systemId: systemId,
                segmentNumber: i + 1,
                hasCabinet: false
            };

            this.currentElements.conveyors.push(segmentData);
            conveyorSystem.segments.push(segmentData);
        }

        this.conveyorSystems.push(conveyorSystem);
        console.log(`Created conveyor system ${systemId} with production time: ${productionTime / 60000}min`);
    }


    createTimeControlPanel() {
        const timePanel = document.createElement('div');
        timePanel.className = 'time-control-panel';
        timePanel.innerHTML = `
            <h3>Управление временем</h3>
            <div class="time-controls">
                <div class="time-control-group">
                    <label>Общая скорость:</label>
                    <select id="global-speed">
                        <option value="0.5">0.5x</option>
                        <option value="1" selected>1x</option>
                        <option value="2">2x</option>
                        <option value="5">5x</option>
                        <option value="10">10x</option>
                    </select>
                </div>
                <div class="time-control-group">
                    <label>Скорость конвейеров:</label>
                    <select id="conveyor-speed">
                        <option value="0.5">0.5x</option>
                        <option value="1" selected>1x</option>
                        <option value="2">2x</option>
                        <option value="5">5x</option>
                    </select>
                </div>
                <div class="time-control-group">
                    <label>Скорость роботов:</label>
                    <select id="robot-speed">
                        <option value="0.5">0.5x</option>
                        <option value="1" selected>1x</option>
                        <option value="2">2x</option>
                        <option value="5">5x</option>
                    </select>
                </div>
            </div>
            <div class="statistics-panel">
                <h4>Статистика</h4>
                <div id="cabinets-count">Собрано шкафов: 0</div>
                <div id="robots-stats">Статистика роботов:</div>
            </div>
        `;

        document.querySelector('.container').appendChild(timePanel);

        // Обработчики событий
        document.getElementById('global-speed').addEventListener('change', (e) => {
            this.timeSettings.globalSpeed = parseFloat(e.target.value);
            this.updateTimeSettings();
        });

        document.getElementById('conveyor-speed').addEventListener('change', (e) => {
            this.timeSettings.conveyorSpeed = parseFloat(e.target.value);
            this.updateTimeSettings();
        });

        document.getElementById('robot-speed').addEventListener('change', (e) => {
            this.timeSettings.robotSpeed = parseFloat(e.target.value);
            this.updateTimeSettings();
        });
    }

    updateTimeSettings() {
        console.log('Time settings updated:', this.timeSettings);
        this.updateAllProcessSpeeds();
    }

    updateAllProcessSpeeds() {
        // Применяем настройки скорости ко всем активным процессам
        if (this.timeSettings.simulationRunning) {
            this.updateConveyorSpeeds();
            this.updateRobotSpeeds();
        }
    }

    get currentLayer() {
        return this.layers[this.currentLayerId];
    }

    get currentElements() {
        return this.currentLayer.elements;
    }

    get currentSimulation() {
        return this.currentLayer.simulation;
    }

    init() {
        this.setupWorkshop();
        this.setupEventListeners();
        this.createSnapPoints();
        this.setupLayers();
        this.loadConfiguration();
    }

    setupWorkshop() {
        this.workshop.style.width = this.config.workshop.width + 'px';
        this.workshop.style.height = this.config.workshop.height + 'px';

        this.workshop.addEventListener('click', (e) => this.handleWorkshopClick(e));

        document.querySelectorAll('.tool').forEach(tool => {
            tool.addEventListener('click', () => {
                if (tool.dataset.tool === 'delete') return;
                this.selectTool(tool.dataset.tool);
                this.setDeleteMode(false);
            });
        });
    }

    setupLayers() {
        this.updateLayerSelect();
        this.updateLayerDisplay();
    }

    startConveyorSimulation() {
        this.timeSettings.simulationRunning = true;
        this.lastUpdateTime = Date.now();
        this.processConveyors();
    }

    async processConveyors() {
        while (this.timeSettings.simulationRunning) {
            const currentTime = Date.now();
            const deltaTime = currentTime - this.lastUpdateTime;
            this.lastUpdateTime = currentTime;

            // Обрабатываем все системы конвейеров
            this.conveyorSystems.forEach(system => {
                this.processConveyorSystem(system, deltaTime);
            });

            // Обновляем анимации шкафов
            this.updateCabinetAnimations();

            await this.delay(100); // Частое обновление для плавной анимации
        }
    }

    updateCabinetAnimations() {
        // Плавные анимации для всех шкафов
        this.conveyorSystems.forEach(system => {
            if (system.activeCabinet) {
                system.activeCabinet.element.style.transition = `left 0.1s linear, top 0.1s linear`;
            }
        });
    }

    processConveyorSystem(system, deltaTime) {
        // ПРИМЕНЯЕМ ВСЕ НАСТРОЙКИ СКОРОСТИ ДЛЯ КОНВЕЙЕРА
        const scaledDeltaTime = deltaTime * this.timeSettings.globalSpeed * this.timeSettings.conveyorSpeed;

        if (!system.activeCabinet &&
            Date.now() - system.lastCabinetTime >= system.cabinetInterval / (this.timeSettings.globalSpeed * this.timeSettings.conveyorSpeed)) {
            this.createCabinetOnSystem(system);
        }

        if (system.activeCabinet) {
            this.updateCabinetPosition(system, scaledDeltaTime);
        }
    }
    updateCabinetPosition(system, deltaTime) {
        const cabinet = system.activeCabinet;
        const totalSegments = system.segments.length;

        // Время на сегмент (равномерно распределяем 1.5 часа)
        const timePerSegment = system.productionTime / totalSegments;

        // Прогресс внутри текущего сегмента
        cabinet.progress += deltaTime / timePerSegment;

        // Если завершили текущий сегмент
        if (cabinet.progress >= 1) {
            cabinet.currentSegment++;
            cabinet.progress = 0;

            // Обновляем состояние сегментов
            if (cabinet.currentSegment > 1) {
                system.segments[cabinet.currentSegment - 2].hasCabinet = false;
            }

            // Если дошли до конца
            if (cabinet.currentSegment > totalSegments) {
                this.completeCabinet(system);
                return;
            }

            system.segments[cabinet.currentSegment - 1].hasCabinet = true;
        }

        // Общий прогресс
        cabinet.totalProgress = (cabinet.currentSegment - 1 + cabinet.progress) / totalSegments;

        // Увеличиваем вес шкафа (от 1 до 2)
        cabinet.weight = 1 + cabinet.totalProgress;

        // Обновляем визуальную позицию
        this.updateCabinetVisualPosition(system, cabinet);
    }

    updateCabinetVisualPosition(system, cabinet) {
        const currentSegment = system.segments[cabinet.currentSegment - 1];
        const segmentWidth = this.config.workshop.scale;

        // Позиция внутри сегмента
        const segmentProgress = cabinet.progress;
        const cabinetX = currentSegment.x + segmentProgress * segmentWidth;
        const cabinetY = currentSegment.y;

        // Центрируем шкаф
        const centerX = cabinetX + segmentWidth / 4;
        const centerY = cabinetY + segmentWidth / 4;

        cabinet.element.style.left = centerX + 'px';
        cabinet.element.style.top = centerY + 'px';

        // Меняем цвет в зависимости от прогресса сборки
        const progressColor = this.getCabinetColor(cabinet.totalProgress);
        cabinet.element.style.backgroundColor = progressColor;
    }

    getCabinetColor(progress) {
        // От коричневого к темно-коричневому по мере сборки
        const startColor = { r: 139, g: 69, b: 19 }; // SaddleBrown
        const endColor = { r: 101, g: 67, b: 33 }; // Darker brown

        const r = Math.round(startColor.r + (endColor.r - startColor.r) * progress);
        const g = Math.round(startColor.g + (endColor.g - startColor.g) * progress);
        const b = Math.round(startColor.b + (endColor.b - startColor.b) * progress);

        return `rgb(${r}, ${g}, ${b})`;
    }

    createCabinetOnSystem(system) {
        const firstSegment = system.segments[0];

        const cabinet = document.createElement('div');
        cabinet.className = 'element cabinet';
        cabinet.style.width = (this.config.workshop.scale / 2) + 'px';
        cabinet.style.height = (this.config.workshop.scale / 2) + 'px';
        cabinet.style.backgroundColor = '#8B4513';
        cabinet.style.border = '2px solid #654321';
        cabinet.style.borderRadius = '3px';
        cabinet.style.position = 'absolute';
        cabinet.style.zIndex = '15';

        // Центрируем шкаф на сегменте
        const centerX = firstSegment.x + this.config.workshop.scale / 4;
        const centerY = firstSegment.y + this.config.workshop.scale / 4;

        cabinet.style.left = centerX + 'px';
        cabinet.style.top = centerY + 'px';
        cabinet.innerHTML = '⚡';

        this.workshop.appendChild(cabinet);

        system.activeCabinet = {
            element: cabinet,
            systemId: system.id,
            currentSegment: 1,
            progress: 0, // 0-1 прогресс внутри сегмента
            totalProgress: 0, // общий прогресс по всей линии
            weight: 1
        };

        system.lastCabinetTime = Date.now();
        firstSegment.hasCabinet = true;

        console.log(`Cabinet created on conveyor system ${system.id}`);
    }


    processConveyorGroup(conveyorGroup) {
        const segments = this.currentElements.conveyors.filter(c =>
            c.x === conveyorGroup.x && c.y === conveyorGroup.y
        ).sort((a, b) => a.segment - b.segment);

        if (segments.length === 0) return;

        // Создаем новый шкаф на первом сегменте, если нужно
        const firstSegment = segments[0];
        if (!firstSegment.hasCabinet && Math.random() < 0.1) { // 10% шанс создать шкаф
            this.createCabinet(firstSegment);
        }

        // Двигаем шкафы по конвейеру
        this.moveCabinetsOnConveyor(segments);
    }

    createCabinet(segment) {
        const cabinet = document.createElement('div');
        cabinet.className = 'element cabinet';
        cabinet.style.left = segment.x + 'px';
        cabinet.style.top = segment.y + 'px';
        cabinet.style.width = this.config.workshop.scale + 'px';
        cabinet.style.height = this.config.workshop.scale + 'px';
        cabinet.style.backgroundColor = '#8B4513';
        cabinet.style.border = '2px solid #654321';
        cabinet.style.borderRadius = '2px';
        cabinet.innerHTML = '⚡'; // Иконка электрощита

        this.workshop.appendChild(cabinet);

        segment.hasCabinet = true;
        segment.cabinet = {
            element: cabinet,
            segment: segment.segment,
            weight: 1, // начальный вес
            timeOnSegment: 0
        };

        console.log('Cabinet created on segment', segment.segment);
    }

    async moveCabinetsOnConveyor(segments) {
        // Двигаем с конца к началу, чтобы избежать конфликтов
        for (let i = segments.length - 1; i >= 0; i--) {
            const segment = segments[i];

            if (segment.hasCabinet) {
                segment.cabinet.timeOnSegment += (1 * this.timeSettings.globalSpeed * this.timeSettings.conveyorSpeed);

                // Время стояния на сегменте (увеличивается к концу)
                const baseStopTime = 600; // 10 минут в секундах
                const segmentStopTime = baseStopTime * (1 + (segment.segment - 1) * 0.1); // +10% за каждый сегмент

                if (segment.cabinet.timeOnSegment >= segmentStopTime) {
                    // Двигаем на следующий сегмент
                    const nextSegment = segments[i + 1];
                    if (nextSegment && !nextSegment.hasCabinet) {
                        await this.moveCabinetToNextSegment(segment, nextSegment);
                    } else if (!nextSegment) {
                        // Конец конвейера - шкаф собран
                        this.completeCabinet(segment);
                    }
                }
            }
        }
    }

    async moveCabinetToNextSegment(currentSegment, nextSegment) {
        const cabinet = currentSegment.cabinet;
        const moveTime = this.calculateMoveTime(currentSegment.segment, nextSegment.segment);

        // Анимация движения
        cabinet.element.style.transition = `left ${moveTime}ms linear`;
        cabinet.element.style.left = nextSegment.x + 'px';

        await this.delay(moveTime);

        // Обновляем состояние
        currentSegment.hasCabinet = false;
        currentSegment.cabinet = null;

        nextSegment.hasCabinet = true;
        nextSegment.cabinet = cabinet;
        cabinet.segment = nextSegment.segment;
        cabinet.timeOnSegment = 0;
        cabinet.weight += 0.1; // Увеличиваем вес

        console.log(`Cabinet moved from segment ${currentSegment.segment} to ${nextSegment.segment}`);
    }

    calculateMoveTime(fromSegment, toSegment) {
        const baseMoveTime = 10000; // 10 секунд базовое время
        const segmentDiff = toSegment - fromSegment;
        const weightMultiplier = 1 + (fromSegment - 1) * 0.2; // +20% за каждый пройденный сегмент

        // Время движения увеличивается с весом и номером сегмента
        const moveTime = baseMoveTime * segmentDiff * weightMultiplier;

        // Применяем настройки скорости
        return moveTime / (this.timeSettings.globalSpeed * this.timeSettings.conveyorSpeed);
    }

    completeCabinet(system) {
        if (system.activeCabinet && system.activeCabinet.element.parentNode) {
            this.workshop.removeChild(system.activeCabinet.element);
        }

        // Сбрасываем последний сегмент
        const lastSegment = system.segments[system.segments.length - 1];
        lastSegment.hasCabinet = false;

        // Обновляем статистику
        this.statistics.cabinetsProduced++;
        this.updateStatisticsDisplay();

        console.log(`Cabinet completed on system ${system.id}! Total: ${this.statistics.cabinetsProduced}`);
        system.activeCabinet = null;
    }


    updateLayerSelect() {
        const select = document.getElementById('layer-select');
        if (!select) return;

        select.innerHTML = '';
        Object.values(this.layers).forEach(layer => {
            const option = document.createElement('option');
            option.value = layer.id;
            option.textContent = layer.name;
            option.selected = layer.id === this.currentLayerId;
            select.appendChild(option);
        });
    }

    updateLayerDisplay() {
        const currentLayerElement = document.getElementById('current-layer');
        if (currentLayerElement) {
            currentLayerElement.textContent = `Текущий слой: ${this.currentLayer.name}`;
        }
    }

    addLayer() {
        this.layerCounter++;
        const layerId = `layer-${this.layerCounter - 1}`;
        const layerName = `Слой ${this.layerCounter}`;

        this.layers[layerId] = {
            id: layerId,
            name: layerName,
            visible: true,
            elements: {
                robot: null,
                warehouse: null,
                conveyors: [],
                posts: [],
                pathNodes: [],
                pathLines: []
            },
            simulation: {
                running: false,
                paused: false,
                currentPath: [],
                currentTargetIndex: 0,
                currentAnimation: null,
                postsToVisit: [],
                visitedPosts: 0,
                totalPosts: 0
            }
        };

        this.switchLayer(layerId);
        this.updateLayerSelect();
    }

    removeLayer() {
        if (Object.keys(this.layers).length <= 1) {
            alert('Нельзя удалить последний слой!');
            return;
        }

        this.clearLayerFromDOM(this.currentLayer);

        delete this.layers[this.currentLayerId];

        const remainingLayerId = Object.keys(this.layers)[0];
        this.switchLayer(remainingLayerId);
        this.updateLayerSelect();
    }

    clearLayerFromDOM(layer) {
        const elements = layer.elements;

        if (elements.robot && elements.robot.parentNode) {
            this.workshop.removeChild(elements.robot);
        }
        if (elements.warehouse && elements.warehouse.parentNode) {
            this.workshop.removeChild(elements.warehouse);
        }

        elements.conveyors.forEach(conv => {
            if (conv.element.parentNode) this.workshop.removeChild(conv.element);
        });
        elements.posts.forEach(post => {
            if (post.element.parentNode) this.workshop.removeChild(post.element);
            if (post.infoElement && post.infoElement.parentNode) this.workshop.removeChild(post.infoElement);
        });
        elements.pathNodes.forEach(node => {
            if (node.element.parentNode) this.workshop.removeChild(node.element);
        });
        elements.pathLines.forEach(line => {
            if (line.element.parentNode) this.workshop.removeChild(line.element);
            if (line.labelElement && line.labelElement.parentNode) this.workshop.removeChild(line.labelElement);
        });

        if (elements.mergedRobots) {
            elements.mergedRobots.forEach(robotData => {
                if (robotData.element.parentNode) this.workshop.removeChild(robotData.element);
                if (robotData.label.parentNode) this.workshop.removeChild(robotData.label);
                if (robotData.infoElement && robotData.infoElement.parentNode) this.workshop.removeChild(robotData.infoElement);
            });
        }

        if (elements.mergedWarehouses) {
            elements.mergedWarehouses.forEach(warehouseData => {
                if (warehouseData.element.parentNode) this.workshop.removeChild(warehouseData.element);
            });
        }
    }

    switchLayer(layerId) {
        if (!this.layers[layerId]) return;

        this.stopSimulation();

        this.workshop.innerHTML = '';

        this.currentLayerId = layerId;

        this.restoreLayerToDOM(this.currentLayer);

        this.updateLayerDisplay();
        this.createSnapPoints();
    }

    restoreLayerToDOM(layer) {
        const elements = layer.elements;

        if (elements.robot) {
            this.workshop.appendChild(elements.robot);
        }

        if (elements.warehouse) {
            this.workshop.appendChild(elements.warehouse);
        }

        elements.conveyors.forEach(conv => {
            this.workshop.appendChild(conv.element);
        });

        elements.posts.forEach(post => {
            this.workshop.appendChild(post.element);
            if (post.infoElement) this.workshop.appendChild(post.infoElement);
        });

        elements.pathNodes.forEach(node => {
            this.workshop.appendChild(node.element);
        });

        elements.pathLines.forEach(line => {
            this.workshop.appendChild(line.element);
            if (line.labelElement) this.workshop.appendChild(line.labelElement);
        });

        if (elements.mergedRobots) {
            elements.mergedRobots.forEach(robotData => {
                this.workshop.appendChild(robotData.element);
                this.workshop.appendChild(robotData.label);
                if (robotData.infoElement) this.workshop.appendChild(robotData.infoElement);
            });
        }

        if (elements.mergedWarehouses) {
            elements.mergedWarehouses.forEach(warehouseData => {
                this.workshop.appendChild(warehouseData.element);
            });
        }
    }

    setDeleteMode(mode) {
        this.deleteMode = mode;
        const deleteBtn = document.getElementById('delete-btn');

        if (this.deleteMode) {
            deleteBtn.style.backgroundColor = '#ff0000';
            deleteBtn.textContent = 'Режим удаления (кликните на объект)';
            this.workshop.style.cursor = 'pointer';
        } else {
            deleteBtn.style.backgroundColor = '#dc3545';
            deleteBtn.textContent = 'Удалить объекты';
            this.workshop.style.cursor = 'default';
        }
    }

    createSnapPoints() {
        const gridSize = this.config.workshop.scale;
        const width = this.config.workshop.width;
        const height = this.config.workshop.height;

        document.querySelectorAll('.snap-point').forEach(point => point.remove());

        for (let x = 0; x <= width; x += gridSize) {
            for (let y = 0; y <= height; y += gridSize) {
                const point = document.createElement('div');
                point.className = 'snap-point';
                point.style.left = x + 'px';
                point.style.top = y + 'px';
                this.workshop.appendChild(point);
            }
        }
    }

    findClosestSnapPoint(x, y) {
        const gridSize = this.config.workshop.scale;
        const snapX = Math.round(x / gridSize) * gridSize;
        const snapY = Math.round(y / gridSize) * gridSize;
        return { x: snapX, y: snapY };
    }

    setupEventListeners() {
        const debugNodesBtn = document.getElementById('debug-nodes-btn');
        if (debugNodesBtn) {
            debugNodesBtn.addEventListener('click', () => this.debugNodes());
        }
        const debugPositionsBtn = document.getElementById('debug-positions-btn');
        if (debugPositionsBtn) {
            debugPositionsBtn.addEventListener('click', () => this.debugElementPositions());
        }
        const debugBtn = document.getElementById('debug-btn');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => this.debugMergedLayers());
        }
        const controlButtons = ['save-btn', 'load-btn', 'start-btn', 'stop-btn', 'resume-btn', 'reset-btn', 'delete-btn', 'auto-route-btn'];

        controlButtons.forEach(btnId => {
            const button = document.getElementById(btnId);
            if (button) {
                switch (btnId) {
                    case 'save-btn':
                        button.addEventListener('click', () => this.saveConfiguration());
                        break;
                    case 'load-btn':
                        button.addEventListener('click', () => this.loadConfiguration());
                        break;
                    case 'start-btn':
                        button.addEventListener('click', () => this.startSimulation());
                        break;
                    case 'stop-btn':
                        button.addEventListener('click', () => this.stopSimulation());
                        break;
                    case 'resume-btn':
                        button.addEventListener('click', () => this.resumeSimulation());
                        break;
                    case 'reset-btn':
                        button.addEventListener('click', () => this.resetSimulation());
                        break;
                    case 'delete-btn':
                        button.addEventListener('click', () => this.toggleDeleteMode());
                        break;
                    case 'auto-route-btn':
                        button.addEventListener('click', () => this.generateAutoRoute());
                        break;
                }
            }
        });

        const addLayerBtn = document.getElementById('add-layer-btn');
        const removeLayerBtn = document.getElementById('remove-layer-btn');
        const layerSelect = document.getElementById('layer-select');
        const mergeLayersBtn = document.getElementById('merge-layers-btn');

        if (addLayerBtn) addLayerBtn.addEventListener('click', () => this.addLayer());
        if (removeLayerBtn) removeLayerBtn.addEventListener('click', () => this.removeLayer());
        if (mergeLayersBtn) mergeLayersBtn.addEventListener('click', () => this.mergeLayers());
        if (layerSelect) layerSelect.addEventListener('change', (e) => this.switchLayer(e.target.value));

        const modalButtons = {
            'save-post': () => this.savePostConfig(),
            'cancel-post': () => this.closePostModal(),
            'save-length': () => this.saveLineLength(),
            'cancel-length': () => this.closeLengthModal(),
            'save-connection': () => this.saveConnectionLength(),
            'cancel-connection': () => this.cancelConnection(),
            'save-robot': () => this.saveRobotConfig(),
            'cancel-robot': () => this.closeRobotModal(),
            'save-conveyor': () => this.saveConveyorConfig(),
            'cancel-conveyor': () => this.closeConveyorModal()
        };

        this.setupModalEnterHandlers();
        Object.keys(modalButtons).forEach(btnId => {
            const button = document.getElementById(btnId);
            if (button) {
                button.addEventListener('click', modalButtons[btnId]);
            }
        });
    }
    serializeLayersForSave() {
        const serializedLayers = {};
        
        Object.keys(this.layers).forEach(layerId => {
            const layer = this.layers[layerId];
            
            serializedLayers[layerId] = {
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                elements: this.serializeElements(layer.elements),
                simulation: {
                    running: layer.simulation.running,
                    paused: layer.simulation.paused,
                    visitedPosts: layer.simulation.visitedPosts,
                    totalPosts: layer.simulation.totalPosts
                }
            };
        });
        
        return serializedLayers;
    }
    serializeElements(elements) {
        const serialized = {
            robot: elements.robot ? {
                x: parseFloat(elements.robot.style.left),
                y: parseFloat(elements.robot.style.top),
                type: elements.robot.type || 'robot',
                speed: elements.robot.speed || 0.6,
                postStopTime: elements.robot.postStopTime || 30,
                warehouseStopTime: elements.robot.warehouseStopTime || 300
            } : null,
            
            warehouse: elements.warehouse ? {
                x: parseFloat(elements.warehouse.style.left),
                y: parseFloat(elements.warehouse.style.top)
            } : null,
            
            conveyors: elements.conveyors.map(conv => ({
                x: conv.x,
                y: conv.y,
                systemId: conv.systemId,
                segmentNumber: conv.segmentNumber
            })),
            
            posts: elements.posts.map(post => ({
                x: post.x,
                y: post.y,
                type: post.type || 'post',
                conveyor: post.conveyor || 1,
                number: post.number || 1,
                visited: post.visited || false
            })),
            
            pathNodes: elements.pathNodes.map(node => ({
                x: node.x,
                y: node.y,
                layerIndex: node.layerIndex // сохраняем индекс слоя
            })),
            
            pathLines: elements.pathLines.map(line => ({
                startX: line.startNode.x,
                startY: line.startNode.y,
                endX: line.endNode.x,
                endY: line.endNode.y,
                length: line.length,
                layerIndex: line.layerIndex // сохраняем индекс слоя
            }))
        };
    
        // ДОБАВЛЯЕМ СЕРИАЛИЗАЦИЮ СОВМЕЩЕННЫХ ЭЛЕМЕНТОВ
        if (elements.mergedRobots) {
            serialized.mergedRobots = elements.mergedRobots.map(robot => ({
                x: parseFloat(robot.element.style.left),
                y: parseFloat(robot.element.style.top),
                layerIndex: robot.layerIndex,
                layerId: robot.layerId,
                speed: robot.speed || 0.6,
                postStopTime: robot.postStopTime || 30,
                warehouseStopTime: robot.warehouseStopTime || 300,
                type: robot.type || 'robot',
                color: robot.color
            }));
        }
    
        if (elements.mergedWarehouses) {
            serialized.mergedWarehouses = elements.mergedWarehouses.map(warehouse => ({
                x: warehouse.x,
                y: warehouse.y,
                layerIndex: warehouse.layerIndex
            }));
        }
    
        return serialized;
    }
    setupModalEnterHandlers() {
        // Модальное окно поста
        const postModal = document.getElementById('post-modal');
        if (postModal) {
            const inputs = postModal.querySelectorAll('input');
            const saveBtn = document.getElementById('save-post');

            inputs.forEach(input => {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        saveBtn.click();
                    }
                });
            });
        }

        // Модальное окно длины соединения
        const connectionModal = document.getElementById('connection-modal');
        if (connectionModal) {
            const input = document.getElementById('connection-length');
            const saveBtn = document.getElementById('save-connection');

            if (input && saveBtn) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        saveBtn.click();
                    }
                });
            }
        }

        // Модальное окно длины линии
        const lengthModal = document.getElementById('length-modal');
        if (lengthModal) {
            const input = document.getElementById('line-length');
            const saveBtn = document.getElementById('save-length');

            if (input && saveBtn) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        saveBtn.click();
                    }
                });
            }
        }

        // Модальное окно робота
        const robotModal = document.getElementById('robot-modal');
        if (robotModal) {
            const inputs = robotModal.querySelectorAll('input');
            const saveBtn = document.getElementById('save-robot');

            inputs.forEach(input => {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        saveBtn.click();
                    }
                });
            });
        }

        const conveyorModal = document.getElementById('conveyor-modal');
        if (conveyorModal) {
            const inputs = conveyorModal.querySelectorAll('input');
            const saveBtn = document.getElementById('save-conveyor');

            inputs.forEach(input => {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        saveBtn.click();
                    }
                });
            });
        }
    }

    closeConveyorModal() {
        const modal = document.getElementById('conveyor-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentConveyorForEdit = null;
    }

    selectTool(tool) {
        console.log('Tool selected:', tool);
        this.selectedTool = tool;
        document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
        const activeTool = document.querySelector(`.tool[data-tool="${tool}"]`);
        if (activeTool) {
            activeTool.classList.add('active');
        }

        if (tool !== 'path') {
            this.resetNodeSelection();
        }
    }

    resetNodeSelection() {
        if (this.firstNodeForConnection) {
            this.firstNodeForConnection.element.classList.remove('connected');
            this.firstNodeForConnection = null;
        }
    }

    toggleDeleteMode() {
        this.deleteMode = !this.deleteMode;
        this.setDeleteMode(this.deleteMode);

        if (this.deleteMode) {
            this.selectedTool = null;
            document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
            // Добавляем класс для режима удаления
            this.workshop.classList.add('delete-mode');
        } else {
            // Убираем класс режима удаления
            this.workshop.classList.remove('delete-mode');
        }
    }
    handleWorkshopClick(e) {
        if (this.deleteMode) {
            this.handleDelete(e);
            return;
        }

        if (!this.selectedTool) return;

        const rect = this.workshop.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const snapPoint = this.findClosestSnapPoint(x, y);
        const finalX = snapPoint.x;
        const finalY = snapPoint.y;

        console.log('Placing element:', this.selectedTool, 'at', finalX, finalY);

        switch (this.selectedTool) {
            case 'robot':
                this.placeRobot(finalX, finalY, 'robot');
                break;
            case 'big-robot':
                this.placeRobot(finalX, finalY, 'bigRobot');
                break;
            case 'warehouse':
                this.placeWarehouse(finalX, finalY);
                break;
            case 'conveyor':
                this.placeConveyor(finalX, finalY);
                break;
            case 'post':
                this.placePost(finalX, finalY, 'post');
                break;
            case 'uis':
                this.placePost(finalX, finalY, 'uis');
                break;
            case 'node':
                this.placePathNode(finalX, finalY);
                break;
            case 'path':
                this.handlePathToolClick(e);
                break;
        }
    }

    handlePathToolClick(e) {
        const clickedNode = e.target.closest('.path-node');
        if (clickedNode) {
            this.connectToNode(clickedNode);
        }
    }

    handleDelete(e) {
        e.stopPropagation();
        const element = e.target.closest('.element, .path-node, .path-line, .post-info, .line-length, .robot-label, .warehouse, .robot-info, .conveyor');
        if (!element) return;

        // Обработка удаления конвейерной системы
        if (element.classList.contains('conveyor') || element.classList.contains('conveyor-segment')) {
            this.removeConveyorSystem(element);
            return;
        }

        console.log('Deleting element:', element.className);

        if (element.classList.contains('path-node')) {
            console.log('Deleting path node');
            this.removePathNode(element);
            return;
        } else if (element.classList.contains('path-line')) {
            console.log('Deleting path line');
            this.removePathLine(element);
            return;
        }

        // Остальной код удаления элементов...
        if (element.classList.contains('element')) {
            if (element.classList.contains('robot')) {
                if (this.currentElements.robot && this.currentElements.robot.parentNode) {
                    this.workshop.removeChild(this.currentElements.robot);
                }
                this.currentElements.robot = null;
            } else if (element.classList.contains('warehouse')) {
                if (this.currentElements.warehouse && this.currentElements.warehouse.parentNode) {
                    this.workshop.removeChild(this.currentElements.warehouse);
                }
                this.currentElements.warehouse = null;
            } else if (element.classList.contains('conveyor')) {
                if (element.parentNode) {
                    this.workshop.removeChild(element);
                }
                this.currentElements.conveyors = this.currentElements.conveyors.filter(conv => conv.element !== element);
            } else if (element.classList.contains('post')) {
                const post = this.currentElements.posts.find(p => p.element === element);
                if (post) {
                    if (post.infoElement && post.infoElement.parentNode) {
                        this.workshop.removeChild(post.infoElement);
                    }
                    if (post.element.parentNode) {
                        this.workshop.removeChild(post.element);
                    }
                    this.currentElements.posts = this.currentElements.posts.filter(p => p !== post);
                }
            }
        } else if (element.classList.contains('path-node')) {
            console.log('Deleting path node');
            this.removePathNode(element);
            return; // Важно: возвращаемся после удаления узла
        } else if (element.classList.contains('path-line')) {
            console.log('Deleting path line');
            this.removePathLine(element);
            return; // Важно: возвращаемся после удаления линии
        } else if (element.classList.contains('post-info')) {
            const post = this.currentElements.posts.find(p => p.infoElement === element);
            if (post) {
                if (post.element.parentNode) this.workshop.removeChild(post.element);
                if (post.infoElement.parentNode) this.workshop.removeChild(post.infoElement);
                this.currentElements.posts = this.currentElements.posts.filter(p => p !== post);
            }
        } else if (element.classList.contains('line-length')) {
            this.editLineLengthFromLabel(element);
        } else if (element.classList.contains('robot-label')) {
            const robotData = this.currentElements.mergedRobots && this.currentElements.mergedRobots.find(r => r.label === element);
            if (robotData) {
                if (robotData.element.parentNode) this.workshop.removeChild(robotData.element);
                if (robotData.label.parentNode) this.workshop.removeChild(robotData.label);
                if (robotData.infoElement && robotData.infoElement.parentNode) this.workshop.removeChild(robotData.infoElement);
                this.currentElements.mergedRobots = this.currentElements.mergedRobots.filter(r => r !== robotData);
            }
        } else if (element.classList.contains('robot-info')) {
            const robotData = this.currentElements.mergedRobots && this.currentElements.mergedRobots.find(r => r.infoElement === element);
            if (robotData) {
                if (robotData.element.parentNode) this.workshop.removeChild(robotData.element);
                if (robotData.label.parentNode) this.workshop.removeChild(robotData.label);
                if (robotData.infoElement.parentNode) this.workshop.removeChild(robotData.infoElement);
                this.currentElements.mergedRobots = this.currentElements.mergedRobots.filter(r => r !== robotData);
            } else if (this.currentElements.robot && this.currentElements.robot.infoElement === element) {
                if (this.currentElements.robot.parentNode) {
                    this.workshop.removeChild(this.currentElements.robot);
                }
                if (this.currentElements.robot.infoElement.parentNode) {
                    this.workshop.removeChild(this.currentElements.robot.infoElement);
                }
                this.currentElements.robot = null;
            }
        } else if (element.classList.contains('warehouse')) {
            const warehouseData = this.currentElements.mergedWarehouses && this.currentElements.mergedWarehouses.find(w => w.element === element);
            if (warehouseData) {
                if (warehouseData.element.parentNode) this.workshop.removeChild(warehouseData.element);
                this.currentElements.mergedWarehouses = this.currentElements.mergedWarehouses.filter(w => w !== warehouseData);
            } else if (this.currentElements.warehouse === element) {
                if (this.currentElements.warehouse.parentNode) {
                    this.workshop.removeChild(this.currentElements.warehouse);
                }
                this.currentElements.warehouse = null;
            }
        }
    }

    removeConveyorSystem(conveyorElement) {
        const systemId = conveyorElement.dataset.system;

        // Находим и удаляем всю систему конвейеров
        const system = this.conveyorSystems.find(sys => sys.id == systemId);
        if (system) {
            // Удаляем все сегменты конвейера
            system.segments.forEach(segment => {
                if (segment.element.parentNode) {
                    this.workshop.removeChild(segment.element);
                }
                // Удаляем активный шкаф если есть
                if (system.activeCabinet && system.activeCabinet.element.parentNode) {
                    this.workshop.removeChild(system.activeCabinet.element);
                }
            });

            // Удаляем из массивов
            this.conveyorSystems = this.conveyorSystems.filter(sys => sys.id != systemId);
            this.currentElements.conveyors = this.currentElements.conveyors.filter(
                conv => conv.systemId != systemId
            );

            console.log(`Conveyor system ${systemId} completely removed`);
        }
    }

    placeRobot(x, y, type = 'robot') {
        console.log('Placing robot of type:', type);
        this.currentRobotForEdit = {
            x: x,
            y: y,
            type: type,
            speed: 0.6,
            postStopTime: 30,
            warehouseStopTime: 300
        };
        this.openRobotModal();
    }

    placeWarehouse(x, y) {
        if (this.currentElements.warehouse && this.currentElements.warehouse.parentNode) {
            this.workshop.removeChild(this.currentElements.warehouse);
        }

        const warehouse = document.createElement('div');
        warehouse.className = 'element warehouse';
        warehouse.style.left = x + 'px';
        warehouse.style.top = y + 'px';
        warehouse.innerHTML = `<img src="${this.config.images.warehouse}" alt="Склад" style="width:100%;height:100%;">`;

        this.workshop.appendChild(warehouse);
        this.currentElements.warehouse = warehouse;

        this.placePathNode(x, y);
    }

    // placeConveyor(x, y) {
    //     const gridSize = this.config.workshop.scale;
    //     const conveyorLength = 12; // 12 квадратов

    //     // Создаем 12 отдельных квадратов конвейера
    //     for (let i = 0; i < conveyorLength; i++) {
    //         const conveyor = document.createElement('div');
    //         conveyor.className = 'element conveyor conveyor-segment';
    //         conveyor.style.left = (x + i * gridSize) + 'px';
    //         conveyor.style.top = y + 'px';
    //         conveyor.style.width = gridSize + 'px';
    //         conveyor.style.height = gridSize + 'px';

    //         // Белый квадрат
    //         conveyor.style.backgroundColor = 'white';
    //         conveyor.style.border = '1px solid #333';
    //         conveyor.style.display = 'flex';
    //         conveyor.style.alignItems = 'center';
    //         conveyor.style.justifyContent = 'center';
    //         conveyor.style.fontSize = '8px';
    //         conveyor.style.color = '#333';
    //         conveyor.innerHTML = `C${i + 1}`;
    //         conveyor.dataset.segment = i + 1;

    //         this.workshop.appendChild(conveyor);
    //         this.currentElements.conveyors.push({
    //             element: conveyor,
    //             x: x + i * gridSize,
    //             y: y,
    //             segment: i + 1,
    //             hasCabinet: false
    //         });
    //     }

    //     // Создаем узел для начала конвейера
    //     const startNode = this.placePathNode(x, y);
    //     startNode.isConveyorStart = true;

    //     console.log('Created conveyor with 12 segments');
    // }

    // Обновленный метод placeConveyor
    placeConveyor(x, y) {
        this.currentConveyorForEdit = {
            x: x,
            y: y,
            productionTime: 5400000 // 1.5 часа по умолчанию
        };
        this.openConveyorModal();
    }
    openConveyorModal() {
        const modal = document.getElementById('conveyor-modal');
        if (modal) {
            document.getElementById('conveyor-production-time').value =
                this.currentConveyorForEdit.productionTime / 60000; // в минутах
            modal.style.display = 'block';
        }
    }

    saveConveyorConfig() {
        if (!this.currentConveyorForEdit) return;

        const productionTimeInput = document.getElementById('conveyor-production-time');
        if (!productionTimeInput) return;

        const productionTimeMinutes = parseInt(productionTimeInput.value) || 90;
        const productionTimeMs = productionTimeMinutes * 60000;

        // Создаем конвейерную систему с настройками
        const systemId = this.conveyorSystems.length + 1;

        // Смещаем каждый следующий конвейер вниз
        const offsetY = (systemId - 1) * this.config.workshop.scale * 2;

        this.createConveyorSystem(
            this.currentConveyorForEdit.x,
            this.currentConveyorForEdit.y + offsetY,
            systemId,
            productionTimeMs
        );

        this.closeConveyorModal();
    }
    createConveyorNodes(x, y) {
        const gridSize = this.config.workshop.scale;

        // Создаем узлы по углам конвейера
        const corners = [
            { x: x, y: y }, // левый верхний
            { x: x + gridSize, y: y }, // правый верхний
            { x: x, y: y + gridSize }, // левый нижний
            { x: x + gridSize, y: y + gridSize } // правый нижний
        ];

        corners.forEach(corner => {
            this.placePathNode(corner.x, corner.y);
        });
    }

    placePost(x, y, type = 'post') {
        console.log('Placing post of type:', type);

        const post = document.createElement('div');
        post.className = 'element post';
        post.style.left = x + 'px';
        post.style.top = y + 'px';

        // Используем соответствующее изображение в зависимости от типа
        const postImage = type === 'uis'
            ? this.config.images.uis
            : this.config.images.post;

        post.innerHTML = `<img src="${postImage}" alt="${type === 'uis' ? 'УИС' : 'Пост'}" style="width:100%;height:100%;">`;
        post.dataset.postType = type;

        this.workshop.appendChild(post);

        const info = document.createElement('div');
        info.className = 'post-info';
        info.style.left = (x + 20) + 'px';
        info.style.top = (y - 15) + 'px';
        info.textContent = type === 'uis' ? 'УИС?' : '?';

        this.workshop.appendChild(info);

        // Автоматически определяем следующий номер
        const nextNumber = this.getNextPostNumber(type);

        const postData = {
            element: post,
            infoElement: info,
            x: x,
            y: y,
            type: type,
            conveyor: type === 'uis' ? 0 : 1,
            number: nextNumber,
            visited: false
        };

        this.currentElements.posts.push(postData);

        const postNode = this.placePathNode(x, y);
        postData.node = postNode;

        this.currentPostForEdit = postData;
        this.openPostModal(nextNumber, type);
    }

    // Добавьте метод для получения следующего номера поста
    getNextPostNumber(type = 'post') {
        const posts = this.currentElements.posts.filter(post => post.type === type);
        if (posts.length === 0) return 1;

        // Находим максимальный номер для данного типа
        const maxNumber = Math.max(...posts.map(post => post.number));
        return maxNumber + 1;
    }

    placePathNode(x, y) {
        const existingNode = this.currentElements.pathNodes.find(node =>
            Math.abs(node.x - x) < 5 && Math.abs(node.y - y) < 5
        );

        if (existingNode) {
            return existingNode;
        }

        const node = document.createElement('div');
        node.className = 'path-node';
        node.style.left = x + 'px';
        node.style.top = y + 'px';

        node.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.selectedTool === 'path') {
                this.connectToNode(node);
            }
        });

        this.workshop.appendChild(node);

        const nodeData = {
            element: node,
            x: x,
            y: y,
            connections: []
        };

        this.currentElements.pathNodes.push(nodeData);
        return nodeData;
    }

    openPostModal(defaultNumber = 1, type = 'post') {
        const modal = document.getElementById('post-modal');
        if (modal) {
            // Устанавливаем заголовок в зависимости от типа
            const title = modal.querySelector('h3');
            if (title) {
                title.textContent = type === 'uis' ? 'Настройка УИС' : 'Настройка поста';
            }

            // Скрываем/показываем поле конвейера
            const conveyorGroup = modal.querySelector('.modal-input:first-child');
            if (conveyorGroup) {
                conveyorGroup.style.display = type === 'uis' ? 'none' : 'block';
            }

            // Устанавливаем label для номера
            const numberLabel = modal.querySelector('.modal-input:last-child label');
            if (numberLabel) {
                numberLabel.textContent = type === 'uis' ? 'Номер УИС:' : 'Номер поста:';
            }

            // Устанавливаем следующий номер по умолчанию
            const numberInput = document.getElementById('post-number');
            if (numberInput) {
                numberInput.value = defaultNumber;
            }

            // Добавляем обработчик для клавиши Enter
            const saveBtn = document.getElementById('save-post');
            const inputs = modal.querySelectorAll('input');

            inputs.forEach(input => {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        saveBtn.click();
                    }
                });
            });

            modal.style.display = 'block';
        }
    }

    closePostModal() {
        const modal = document.getElementById('post-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentPostForEdit = null;
    }

    openRobotModal() {
        const modal = document.getElementById('robot-modal');
        if (modal) {
            document.getElementById('robot-speed-input').value = this.currentRobotForEdit.speed;
            document.getElementById('robot-post-time').value = this.currentRobotForEdit.postStopTime;
            document.getElementById('robot-warehouse-time').value = this.currentRobotForEdit.warehouseStopTime;
            modal.style.display = 'block';
        }
    }

    closeRobotModal() {
        const modal = document.getElementById('robot-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentRobotForEdit = null;
    }

    savePostConfig() {
        if (!this.currentPostForEdit) return;

        const conveyorInput = document.getElementById('conveyor-number');
        const numberInput = document.getElementById('post-number');

        if (!numberInput) return;

        const conveyor = this.currentPostForEdit.type === 'uis' ? 0 : (parseInt(conveyorInput?.value) || 1);
        const number = parseInt(numberInput.value) || 1;

        this.currentPostForEdit.conveyor = conveyor;
        this.currentPostForEdit.number = number;

        // Обновляем отображение в зависимости от типа
        if (this.currentPostForEdit.type === 'uis') {
            this.currentPostForEdit.infoElement.textContent = `УИС${number}`;
        } else {
            this.currentPostForEdit.infoElement.textContent = `${conveyor}-${number}`;
        }

        this.closePostModal();
    }

    saveRobotConfig() {
        // Проверка на существование конфигурации робота
        if (!this.currentRobotForEdit) {
            console.error('No robot configuration to save!');
            this.closeRobotModal();
            return;
        }
    
        const speedInput = document.getElementById('robot-speed-input');
        const postTimeInput = document.getElementById('robot-post-time');
        const warehouseTimeInput = document.getElementById('robot-warehouse-time');
    
        // Проверка существования элементов ввода
        if (!speedInput || !postTimeInput || !warehouseTimeInput) {
            console.error('Robot configuration inputs not found!');
            return;
        }
    
        const speed = parseFloat(speedInput.value) || 0.6;
        const postTime = parseInt(postTimeInput.value) || 30;
        const warehouseTime = parseInt(warehouseTimeInput.value) || 300;
    
        // Удаляем существующего робота если есть
        if (this.currentElements.robot && this.currentElements.robot.parentNode) {
            this.workshop.removeChild(this.currentElements.robot);
            if (this.currentElements.robot.infoElement && this.currentElements.robot.infoElement.parentNode) {
                this.workshop.removeChild(this.currentElements.robot.infoElement);
            }
        }
    
        const robot = document.createElement('div');
        robot.className = 'element robot';
        robot.style.left = this.currentRobotForEdit.x + 'px';
        robot.style.top = this.currentRobotForEdit.y + 'px';
    
        // Используем соответствующее изображение в зависимости от типа
        const robotType = this.currentRobotForEdit.type || 'robot';
        const robotImage = robotType === 'bigRobot'
            ? this.config.images.bigRobot
            : this.config.images.robot;
    
        robot.innerHTML = `<img src="${robotImage}" alt="Робот" style="width:100%;height:100%;">`;
        robot.dataset.robotType = robotType;
    
        this.workshop.appendChild(robot);
        this.currentElements.robot = robot;
    
        const info = document.createElement('div');
        info.className = 'robot-info';
        info.style.left = (this.currentRobotForEdit.x + 20) + 'px';
        info.style.top = (this.currentRobotForEdit.y - 15) + 'px';
        info.textContent = `v=${speed}m/s`;
        info.style.cssText = `
            position: absolute;
            background: white;
            padding: 2px 6px;
            border: 1px solid #007bff;
            border-radius: 3px;
            font-size: 10px;
            pointer-events: none;
            z-index: 11;
            white-space: nowrap;
        `;
    
        this.workshop.appendChild(info);
    
        // Сохраняем данные робота
        this.currentElements.robot.speed = speed;
        this.currentElements.robot.postStopTime = postTime;
        this.currentElements.robot.warehouseStopTime = warehouseTime;
        this.currentElements.robot.infoElement = info;
        this.currentElements.robot.type = robotType;
    
        this.placePathNode(this.currentRobotForEdit.x, this.currentRobotForEdit.y);
        this.closeRobotModal();
    
        console.log('Robot created with type:', robotType);
    }

    removePathNode(nodeElement) {
        console.log('Attempting to remove path node');

        const nodeIndex = this.currentElements.pathNodes.findIndex(n => n.element === nodeElement);
        if (nodeIndex === -1) {
            console.log('Node not found in current elements');
            return;
        }

        const node = this.currentElements.pathNodes[nodeIndex];
        console.log('Removing path node with', node.connections.length, 'connections');

        // Создаем копию соединений для безопасного удаления
        const connectionsToRemove = [...node.connections];

        connectionsToRemove.forEach(connection => {
            const connectedNode = connection.node;
            if (connectedNode) {
                console.log('Removing connection from connected node');
                // Удаляем соединение из связанного узла
                connectedNode.connections = connectedNode.connections.filter(c => c.lineElement !== connection.lineElement);

                // Удаляем линию
                const lineElement = connection.lineElement;
                if (lineElement && lineElement.parentNode) {
                    console.log('Removing line element');
                    const lineIndex = this.currentElements.pathLines.findIndex(l => l.element === lineElement);
                    if (lineIndex !== -1) {
                        const lineData = this.currentElements.pathLines[lineIndex];
                        // Удаляем label линии
                        if (lineData.labelElement && lineData.labelElement.parentNode) {
                            this.workshop.removeChild(lineData.labelElement);
                        }
                        // Удаляем саму линию
                        this.workshop.removeChild(lineElement);
                        this.currentElements.pathLines.splice(lineIndex, 1);
                        console.log('Line removed successfully');
                    }
                }
            }
        });

        // Удаляем узел
        if (node.element.parentNode) {
            this.workshop.removeChild(node.element);
            console.log('Node element removed from DOM');
        }
        this.currentElements.pathNodes.splice(nodeIndex, 1);
        console.log('Node removed from array');

        // Обновляем ссылки на узлы в постах
        this.currentElements.posts.forEach(post => {
            if (post.node === node) {
                post.node = null;
                console.log('Cleared node reference from post');
            }
        });

        console.log('Path node removal completed');
    }

    connectToNode(secondNodeElement) {
        const secondNode = this.currentElements.pathNodes.find(n => n.element === secondNodeElement);
        if (!secondNode) return;

        if (!this.firstNodeForConnection) {
            this.firstNodeForConnection = secondNode;
            secondNodeElement.classList.add('connected');
        } else {
            const firstNode = this.firstNodeForConnection;

            if (firstNode !== secondNode && !this.areNodesConnected(firstNode, secondNode)) {
                this.pendingConnection = { node1: firstNode, node2: secondNode };
                this.openConnectionModal();
            } else {
                this.resetNodeSelection();
            }
        }
    }

    openConnectionModal() {
        const modal = document.getElementById('connection-modal');
        const input = document.getElementById('connection-length');

        if (modal && input) {
            const distance = Math.sqrt(
                Math.pow(this.pendingConnection.node2.x - this.pendingConnection.node1.x, 2) +
                Math.pow(this.pendingConnection.node2.y - this.pendingConnection.node1.y, 2)
            ) / this.config.workshop.scale;

            input.value = distance.toFixed(1);
            modal.style.display = 'block';
        }
    }

    saveConnectionLength() {
        const modal = document.getElementById('connection-modal');
        const input = document.getElementById('connection-length');

        if (!modal || !input || !this.pendingConnection) return;

        const length = parseFloat(input.value);

        if (isNaN(length) || length <= 0) {
            alert('Пожалуйста, введите корректную длину');
            return;
        }

        this.createConnection(this.pendingConnection.node1, this.pendingConnection.node2, length);

        modal.style.display = 'none';
        this.pendingConnection = null;
        this.resetNodeSelection();
    }

    cancelConnection() {
        const modal = document.getElementById('connection-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.pendingConnection = null;
        this.resetNodeSelection();
    }

    areNodesConnected(node1, node2) {
        return node1.connections.some(conn => conn.node === node2) ||
            node2.connections.some(conn => conn.node === node1);
    }

    createConnection(node1, node2, customLength = null) {
        const line = document.createElement('div');
        line.className = 'path-line';

        const visualLength = Math.sqrt(Math.pow(node2.x - node1.x, 2) + Math.pow(node2.y - node1.y, 2));
        const angle = Math.atan2(node2.y - node1.y, node2.x - node1.x) * 180 / Math.PI;

        line.style.width = visualLength + 'px';
        line.style.left = node1.x + 'px';
        line.style.top = node1.y + 'px';
        line.style.transform = `rotate(${angle}deg)`;

        this.workshop.appendChild(line);

        const connectionLength = customLength || (visualLength / this.config.workshop.scale);

        const connectionData = {
            node: node2,
            lineElement: line,
            length: connectionLength
        };

        node1.connections.push(connectionData);
        node2.connections.push({
            node: node1,
            lineElement: line,
            length: connectionLength
        });

        const lineData = {
            element: line,
            startNode: node1,
            endNode: node2,
            length: connectionLength,
            labelElement: null
        };

        this.currentElements.pathLines.push(lineData);

        this.updateLineLengthDisplay(lineData);
    }

    createConnectionInMergedLayer(node1, node2, length, lineElement) {
        const connectionData1 = {
            node: node2,
            lineElement: lineElement,
            length: length
        };

        const connectionData2 = {
            node: node1,
            lineElement: lineElement,
            length: length
        };

        node1.connections.push(connectionData1);
        node2.connections.push(connectionData2);
    }

    removePathLine(lineElement) {
        console.log('Attempting to remove path line');

        const lineIndex = this.currentElements.pathLines.findIndex(l => l.element === lineElement);
        if (lineIndex === -1) {
            console.log('Line not found in current elements');
            return;
        }

        const line = this.currentElements.pathLines[lineIndex];
        console.log('Removing path line between nodes');

        // Удаляем соединения из обоих узлов
        if (line.startNode) {
            line.startNode.connections = line.startNode.connections.filter(c => c.lineElement !== lineElement);
            console.log('Removed connection from start node');
        }
        if (line.endNode) {
            line.endNode.connections = line.endNode.connections.filter(c => c.lineElement !== lineElement);
            console.log('Removed connection from end node');
        }

        // Удаляем label линии
        if (line.labelElement && line.labelElement.parentNode) {
            this.workshop.removeChild(line.labelElement);
            console.log('Removed line label');
        }

        // Удаляем саму линию
        if (line.element.parentNode) {
            this.workshop.removeChild(line.element);
            console.log('Removed line element');
        }

        this.currentElements.pathLines.splice(lineIndex, 1);
        console.log('Path line removal completed');
    }

    updateLineLengthDisplay(lineData) {
        if (lineData.labelElement && lineData.labelElement.parentNode) {
            this.workshop.removeChild(lineData.labelElement);
        }

        const label = document.createElement('div');
        label.className = 'line-length';
        label.textContent = lineData.length.toFixed(1) + 'м';
        label.style.left = (lineData.startNode.x + (lineData.endNode.x - lineData.startNode.x) / 2) + 'px';
        label.style.top = (lineData.startNode.y + (lineData.endNode.y - lineData.startNode.y) / 2) + 'px';
        label.style.cursor = 'pointer';

        label.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editLineLengthFromLabel(label);
        });

        this.workshop.appendChild(label);
        lineData.labelElement = label;
    }

    editLineLengthFromLabel(labelElement) {
        const lineData = this.currentElements.pathLines.find(line => line.labelElement === labelElement);
        if (!lineData) return;

        this.currentLineForEdit = lineData;
        const modal = document.getElementById('length-modal');
        const input = document.getElementById('line-length');

        if (modal && input) {
            input.value = lineData.length.toFixed(1);
            modal.style.display = 'block';
        }
    }

    saveLineLength() {
        const modal = document.getElementById('length-modal');
        const input = document.getElementById('line-length');

        if (!modal || !input) return;

        const length = parseFloat(input.value);

        if (isNaN(length) || length <= 0) {
            alert('Пожалуйста, введите корректную длину');
            return;
        }

        if (this.currentLineForEdit) {
            this.currentLineForEdit.length = length;
            this.updateLineLengthDisplay(this.currentLineForEdit);
        }

        modal.style.display = 'none';
        this.currentLineForEdit = null;
    }

    closeLengthModal() {
        const modal = document.getElementById('length-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentLineForEdit = null;
    }

    // МЕТОДЫ ДЛЯ СОВМЕЩЕНИЯ СЛОЕВ

    mergeLayers() {
        console.log('Merging layers. Original layers:', Object.keys(this.layers).filter(key => !key.startsWith('merged-')));
        if (Object.keys(this.layers).length <= 1) {
            alert('Для совмещения нужно как минимум 2 слоя!');
            return;
        }

        const mergedLayerId = `merged-${Date.now()}`;
        this.layers[mergedLayerId] = {
            id: mergedLayerId,
            name: 'Совмещенная симуляция',
            visible: true,
            elements: {
                robot: null,
                warehouse: null,
                conveyors: [],
                posts: [],
                pathNodes: [],
                pathLines: [],
                mergedRobots: [],
                mergedWarehouses: []
            },
            simulation: {
                running: false,
                paused: false,
                currentPath: [],
                currentTargetIndex: 0,
                currentAnimation: null,
                postsToVisit: [],
                visitedPosts: 0,
                totalPosts: 0
            }
        };

        const mergedLayer = this.layers[mergedLayerId];
        const originalLayers = Object.values(this.layers).filter(layer => !layer.id.startsWith('merged-'));

        this.copyAllElementsFromAllLayers(originalLayers, mergedLayer);

        // После создания совмещенного слоя
        this.linkPostsToNodesInMergedLayer(mergedLayer);
        this.correctElementPositionsInMergedLayer(mergedLayer);
        setTimeout(() => {
            this.debugNodes();
        }, 100);

        this.switchLayer(mergedLayerId);
        this.updateLayerSelect();
        setTimeout(() => {
            this.debugNodes();
        }, 100);

        this.updateStatus('Слои совмещены. Запустите симуляцию для всех роботов одновременно.');
    }

    copyAllElementsFromAllLayers(originalLayers, targetLayer) {
        targetLayer.elements.conveyors = [];
        targetLayer.elements.posts = [];
        targetLayer.elements.pathNodes = [];
        targetLayer.elements.pathLines = [];
        targetLayer.elements.mergedRobots = [];
        targetLayer.elements.mergedWarehouses = [];

        originalLayers.forEach((sourceLayer, layerIndex) => {
            // Уменьшаем расстояние между слоями
            const offsetX = layerIndex;  // было 200
            const offsetY = layerIndex;  // было 200

            if (sourceLayer.elements.warehouse) {
                const warehouse = sourceLayer.elements.warehouse.cloneNode(true);
                const originalX = parseFloat(sourceLayer.elements.warehouse.style.left);
                const originalY = parseFloat(sourceLayer.elements.warehouse.style.top);

                warehouse.style.left = (originalX + offsetX) + 'px';
                warehouse.style.top = (originalY + offsetY) + 'px';

                targetLayer.elements.mergedWarehouses.push({
                    element: warehouse,
                    x: originalX + offsetX,
                    y: originalY + offsetY,
                    layerIndex: layerIndex
                });
                this.workshop.appendChild(warehouse);
            }

            sourceLayer.elements.conveyors.forEach(conv => {
                const conveyor = conv.element.cloneNode(true);
                conveyor.style.left = (conv.x + offsetX) + 'px';
                conveyor.style.top = (conv.y + offsetY) + 'px';

                targetLayer.elements.conveyors.push({
                    element: conveyor,
                    x: conv.x + offsetX,
                    y: conv.y + offsetY
                });
                this.workshop.appendChild(conveyor);
            });

            sourceLayer.elements.posts.forEach((post, postIndex) => {
                const postElement = post.element.cloneNode(true);
                const infoElement = post.infoElement.cloneNode(true);

                // Используем те же offsetX и offsetY
                postElement.style.left = (post.x + offsetX) + 'px';
                postElement.style.top = (post.y + offsetY) + 'px';
                infoElement.style.left = (post.x + offsetX + 20) + 'px';
                infoElement.style.top = (post.y + offsetY - 15) + 'px';

                const postNumber = `${post.conveyor}-${post.number} (С${layerIndex + 1})`;

                const postData = {
                    element: postElement,
                    infoElement: infoElement,
                    x: post.x + offsetX,
                    y: post.y + offsetY,
                    conveyor: post.conveyor,
                    number: post.number,
                    layerIndex: layerIndex,
                    visited: false,
                    node: null
                };

                targetLayer.elements.posts.push(postData);

                this.workshop.appendChild(postElement);
                this.workshop.appendChild(infoElement);

                infoElement.textContent = postNumber;
            });

            sourceLayer.elements.pathNodes.forEach(originalNode => {
                const nodeElement = originalNode.element.cloneNode(true);
                // Используем те же offsetX и offsetY
                nodeElement.style.left = (originalNode.x + offsetX) + 'px';
                nodeElement.style.top = (originalNode.y + offsetY) + 'px';

                const nodeData = {
                    element: nodeElement,
                    x: originalNode.x + offsetX,
                    y: originalNode.y + offsetY,
                    connections: [],
                    originalNode: originalNode,
                    layerIndex: layerIndex
                };

                targetLayer.elements.pathNodes.push(nodeData);
                this.workshop.appendChild(nodeElement);

                // Клонируем обработчики событий
                nodeElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.selectedTool === 'path') {
                        this.connectToNode(nodeElement);
                    }
                });
            });

            sourceLayer.elements.pathLines.forEach(originalLine => {
                const lineElement = originalLine.element.cloneNode(true);
                // Используем те же offsetX и offsetY

                // Находим соответствующие узлы в совмещенном слое
                const startNode = targetLayer.elements.pathNodes.find(n =>
                    n.originalNode === originalLine.startNode && n.layerIndex === layerIndex
                );
                const endNode = targetLayer.elements.pathNodes.find(n =>
                    n.originalNode === originalLine.endNode && n.layerIndex === layerIndex
                );

                if (startNode && endNode) {
                    const visualLength = Math.sqrt(Math.pow(endNode.x - startNode.x, 2) + Math.pow(endNode.y - startNode.y, 2));
                    const angle = Math.atan2(endNode.y - startNode.y, endNode.x - startNode.x) * 180 / Math.PI;

                    lineElement.style.width = visualLength + 'px';
                    lineElement.style.left = startNode.x + 'px';
                    lineElement.style.top = startNode.y + 'px';
                    lineElement.style.transform = `rotate(${angle}deg)`;

                    const lineData = {
                        element: lineElement,
                        startNode: startNode,
                        endNode: endNode,
                        length: originalLine.length,
                        labelElement: null,
                        layerIndex: layerIndex
                    };

                    targetLayer.elements.pathLines.push(lineData);
                    this.workshop.appendChild(lineElement);

                    // Создаем соединения между узлами
                    this.createConnectionInMergedLayer(startNode, endNode, originalLine.length, lineElement);

                    this.createLineLabel(lineData);
                } else {
                    console.log('Could not find nodes for line in merged layer. Start:', !!startNode, 'End:', !!endNode);
                }
            });

            if (sourceLayer.elements.robot) {
                console.log('Creating merged robot for layer:', layerIndex, 'robot exists:', !!sourceLayer.elements.robot);
                this.createMergedRobot(sourceLayer, layerIndex, targetLayer);
            }
        });
    }

    createMergedRobot(sourceLayer, layerIndex, targetLayer) {
        const colors = ['#007bff', '#dc3545', '#28a745', '#ffc107', '#17a2b8', '#6f42c1'];

        // Получаем позицию робота из исходного слоя
        const originalRobot = sourceLayer.elements.robot;
        let robotX = parseFloat(originalRobot.style.left);
        let robotY = parseFloat(originalRobot.style.top);

        const offsetX = layerIndex * 200;
        const offsetY = layerIndex * 200;
        robotX += offsetX;
        robotY += offsetY;

        console.log('Creating merged robot at position:', robotX, robotY, 'for layer:', layerIndex);

        const robot = document.createElement('div');
        robot.className = 'element robot robot-merged';
        robot.style.left = robotX + 'px';
        robot.style.top = robotY + 'px';
        robot.style.width = '40px';
        robot.style.height = '40px';
        robot.style.border = `3px solid ${colors[layerIndex % colors.length]}`;
        robot.style.borderRadius = '50%';
        robot.style.zIndex = 20 + layerIndex;
        robot.style.background = 'rgba(255, 255, 255, 0.8)';

        // Используем соответствующее изображение
        const robotImage = originalRobot.type === 'bigRobot'
            ? this.config.images.bigRobot
            : this.config.images.robot;

        robot.innerHTML = `<img src="${robotImage}" alt="Робот" style="width:100%;height:100%;border-radius:50%;">`;

        const label = document.createElement('div');
        label.className = 'robot-label';
        label.textContent = `Робот ${layerIndex + 1} (С${layerIndex + 1})`;
        label.style.cssText = `
            position: absolute;
            background: ${colors[layerIndex % colors.length]};
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            white-space: nowrap;
            pointer-events: none;
            z-index: 30;
            font-weight: bold;
        `;

        const info = document.createElement('div');
        info.className = 'robot-info';
        info.textContent = `v=${originalRobot.speed || 0.6}m/s`;
        info.style.cssText = `
            position: absolute;
            background: white;
            padding: 2px 6px;
            border: 1px solid ${colors[layerIndex % colors.length]};
            border-radius: 3px;
            font-size: 10px;
            pointer-events: none;
            z-index: 11;
            white-space: nowrap;
        `;

        const robotData = {
            element: robot,
            label: label,
            infoElement: info,
            layerId: sourceLayer.id,
            layerIndex: layerIndex,
            color: colors[layerIndex % colors.length],
            speed: originalRobot.speed || 0.6,
            postStopTime: originalRobot.postStopTime || 30,
            warehouseStopTime: originalRobot.warehouseStopTime || 300,
            type: originalRobot.type || 'robot', // Сохраняем тип
            simulationData: null
        };

        targetLayer.elements.mergedRobots.push(robotData);

        this.workshop.appendChild(robot);
        this.workshop.appendChild(label);
        this.workshop.appendChild(info);

        // Обновляем позиции label и info
        this.updateRobotLabelPosition(robot, label);
        info.style.left = (robotX + 20) + 'px';
        info.style.top = (robotY - 15) + 'px';

        console.log('Merged robot created successfully at:', robotX, robotY);
    }

    createLineLabel(lineData) {
        const label = document.createElement('div');
        label.className = 'line-length';
        label.textContent = lineData.length.toFixed(1) + 'м';
        label.style.left = (lineData.startNode.x + (lineData.endNode.x - lineData.startNode.x) / 2) + 'px';
        label.style.top = (lineData.startNode.y + (lineData.endNode.y - lineData.startNode.y) / 2) + 'px';
        label.style.cursor = 'pointer';

        label.addEventListener('click', (e) => {
            e.stopPropagation();
            alert('Редактирование длины отключено в совмещенном режиме');
        });

        this.workshop.appendChild(label);
        lineData.labelElement = label;
    }

    prepareMergedSimulationData(layer, layerIndex, mergedLayer) {
        console.log('Preparing simulation data for layer:', layer.id, 'index:', layerIndex);

        if (!layer || !layer.elements.robot || !layer.elements.warehouse || !layer.elements.posts || layer.elements.posts.length === 0) {
            console.log('Missing required elements for layer:', layer ? layer.id : 'no layer',
                'robot:', !!layer?.elements?.robot,
                'warehouse:', !!layer?.elements?.warehouse,
                'posts:', layer?.elements?.posts?.length || 0);
            return null;
        }

        console.log('Finding merged nodes for robot and warehouse...');

        // Находим соответствующие узлы в совмещенном слое
        const robotNode = this.findMergedNode(layer.elements.robot, layerIndex, mergedLayer);
        const warehouseNode = this.findMergedNode(layer.elements.warehouse, layerIndex, mergedLayer);

        console.log('Found merged nodes - robot:', !!robotNode, 'warehouse:', !!warehouseNode);

        if (!robotNode || !warehouseNode) {
            console.log('Could not find merged nodes for layer:', layer.id,
                'robotNode:', !!robotNode, 'warehouseNode:', !!warehouseNode);

            // Попробуем найти узлы через merged элементы
            if (!robotNode && mergedLayer.elements.mergedRobots) {
                const mergedRobot = mergedLayer.elements.mergedRobots.find(r => r.layerIndex === layerIndex);
                if (mergedRobot) {
                    const alternativeRobotNode = this.findMergedNode(mergedRobot.element, layerIndex, mergedLayer);
                    if (alternativeRobotNode) {
                        console.log('Found robot node through merged robot');
                        robotNode = alternativeRobotNode;
                    }
                }
            }

            if (!warehouseNode && mergedLayer.elements.mergedWarehouses) {
                const mergedWarehouse = mergedLayer.elements.mergedWarehouses.find(w => w.layerIndex === layerIndex);
                if (mergedWarehouse) {
                    const alternativeWarehouseNode = this.findMergedNode(mergedWarehouse.element, layerIndex, mergedLayer);
                    if (alternativeWarehouseNode) {
                        console.log('Found warehouse node through merged warehouse');
                        warehouseNode = alternativeWarehouseNode;
                    }
                }
            }

            if (!robotNode || !warehouseNode) {
                return null;
            }
        }

        // Фильтруем посты только для этого слоя
        const layerPosts = mergedLayer.elements.posts.filter(post =>
            post.layerIndex === layerIndex
        );

        // Принудительно ищем узлы для всех постов
        const postsWithNodes = [];
        layerPosts.forEach(post => {
            if (!post.node) {
                // Если у поста нет узла, ищем его
                post.node = this.findMergedNode(post.element, layerIndex, mergedLayer);
            }
            if (post.node) {
                postsWithNodes.push(post);
            } else {
                console.log('Could not find node for post:', post.conveyor, post.number);
            }
        });

        if (postsWithNodes.length === 0) {
            console.log('No posts with nodes found for layer:', layer.id);
            return null;
        }

        const sortedPosts = [...postsWithNodes].sort((a, b) => {
            if (a.conveyor !== b.conveyor) return a.conveyor - b.conveyor;
            return a.number - b.number;
        });

        console.log('Successfully prepared simulation data for', sortedPosts.length, 'posts');

        return {
            robotNode: robotNode,
            warehouseNode: warehouseNode,
            posts: sortedPosts,
            currentPostIndex: 0,
            currentPath: [],
            isMoving: false,
            layerIndex: layerIndex,
            speed: layer.elements.robot.speed || 0.6,
            postStopTime: layer.elements.robot.postStopTime || 30,
            warehouseStopTime: layer.elements.robot.warehouseStopTime || 300
        };
    }



    findMergedNode(originalElement, layerIndex, mergedLayer) {
        if (!originalElement) {
            console.log('No original element provided');
            return null;
        }

        // Получаем позицию элемента из его стилей
        const elementX = parseFloat(originalElement.style.left);
        const elementY = parseFloat(originalElement.style.top);

        console.log('Finding merged node for element at:', elementX, elementY, 'layer:', layerIndex);

        // Ищем ближайший узел в совмещенном слое для этого layerIndex
        let closestNode = null;
        let minDistance = Infinity;
        const searchRadius = 100; // увеличенный радиус поиска

        mergedLayer.elements.pathNodes.forEach(node => {
            if (node.layerIndex === layerIndex) {
                const distance = Math.sqrt(Math.pow(node.x - elementX, 2) + Math.pow(node.y - elementY, 2));
                if (distance < minDistance && distance < searchRadius) {
                    minDistance = distance;
                    closestNode = node;
                }
            }
        });

        if (!closestNode) {
            console.log('No merged node found within radius. Trying to find closest node regardless of radius...');
            // Если не нашли в радиусе, берем самый близкий узел
            mergedLayer.elements.pathNodes.forEach(node => {
                if (node.layerIndex === layerIndex) {
                    const distance = Math.sqrt(Math.pow(node.x - elementX, 2) + Math.pow(node.y - elementY, 2));
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestNode = node;
                    }
                }
            });
        }

        if (closestNode) {
            console.log('Found merged node at:', closestNode.x, closestNode.y, 'distance:', minDistance);
        } else {
            console.log('Could not find any node for element');
        }

        return closestNode;
    }

    linkPostsToNodesInMergedLayer(mergedLayer) {
        console.log('Linking posts to nodes in merged layer...');

        // Связываем посты
        mergedLayer.elements.posts.forEach(post => {
            if (!post.node) {
                const closestNode = this.findMergedNode(post.element, post.layerIndex, mergedLayer);
                if (closestNode) {
                    post.node = closestNode;
                    console.log(`Linked post ${post.conveyor}-${post.number} to node at (${closestNode.x}, ${closestNode.y})`);
                }
            }
        });

        // Связываем роботов с их узлами (для отладки)
        if (mergedLayer.elements.mergedRobots) {
            mergedLayer.elements.mergedRobots.forEach(robot => {
                const robotNode = this.findMergedNode(robot.element, robot.layerIndex, mergedLayer);
                if (robotNode) {
                    console.log(`Robot ${robot.layerIndex} is at node (${robotNode.x}, ${robotNode.y})`);
                } else {
                    console.log(`Could not find node for robot ${robot.layerIndex}`);
                }
            });
        }

        // Связываем склады с их узлами (для отладки)
        if (mergedLayer.elements.mergedWarehouses) {
            mergedLayer.elements.mergedWarehouses.forEach(warehouse => {
                const warehouseNode = this.findMergedNode(warehouse.element, warehouse.layerIndex, mergedLayer);
                if (warehouseNode) {
                    console.log(`Warehouse ${warehouse.layerIndex} is at node (${warehouseNode.x}, ${warehouseNode.y})`);
                } else {
                    console.log(`Could not find node for warehouse ${warehouse.layerIndex}`);
                }
            });
        }
    }

    correctElementPositionsInMergedLayer(mergedLayer) {
        console.log('Correcting element positions in merged layer...');

        // Корректируем позиции роботов
        if (mergedLayer.elements.mergedRobots) {
            mergedLayer.elements.mergedRobots.forEach(robot => {
                const expectedNode = this.findMergedNode(robot.element, robot.layerIndex, mergedLayer);
                if (expectedNode && (parseFloat(robot.element.style.left) !== expectedNode.x || parseFloat(robot.element.style.top) !== expectedNode.y)) {
                    console.log(`Correcting robot ${robot.layerIndex} position from (${robot.element.style.left}, ${robot.element.style.top}) to (${expectedNode.x}, ${expectedNode.y})`);
                    robot.element.style.left = expectedNode.x + 'px';
                    robot.element.style.top = expectedNode.y + 'px';
                    this.updateRobotLabelPosition(robot.element, robot.label);
                    robot.infoElement.style.left = (expectedNode.x + 20) + 'px';
                    robot.infoElement.style.top = (expectedNode.y - 15) + 'px';
                }
            });
        }

        // Корректируем позиции складов
        if (mergedLayer.elements.mergedWarehouses) {
            mergedLayer.elements.mergedWarehouses.forEach(warehouse => {
                const expectedNode = this.findMergedNode(warehouse.element, warehouse.layerIndex, mergedLayer);
                if (expectedNode && (parseFloat(warehouse.element.style.left) !== expectedNode.x || parseFloat(warehouse.element.style.top) !== expectedNode.y)) {
                    console.log(`Correcting warehouse ${warehouse.layerIndex} position to (${expectedNode.x}, ${expectedNode.y})`);
                    warehouse.element.style.left = expectedNode.x + 'px';
                    warehouse.element.style.top = expectedNode.y + 'px';
                }
            });
        }
    }

    updateRobotLabelPosition(robot, label) {
        const robotX = parseFloat(robot.style.left);
        const robotY = parseFloat(robot.style.top);

        label.style.left = (robotX + 20) + 'px';
        label.style.top = (robotY - 20) + 'px';
    }

    // ОСНОВНЫЕ МЕТОДЫ СИМУЛЯЦИИ

    startSimulation() {
        if (this.currentLayerId.startsWith('merged-')) {
            this.startMergedSimulation();
        } else {
            this.startAllLayersSimulation();
        }

        // Запускаем симуляцию конвейеров
        this.startConveyorSimulation();
    }

    startAllLayersSimulation() {
        const layersWithRobots = Object.values(this.layers).filter(layer =>
            !layer.id.startsWith('merged-') &&
            layer.elements.robot &&
            layer.elements.warehouse &&
            layer.elements.posts.length > 0
        );

        if (layersWithRobots.length === 0) {
            alert('Нет слоев с роботами для симуляции!');
            return;
        }

        layersWithRobots.forEach(layer => {
            if (layer.simulation.postsToVisit.length === 0) {
                this.generateAutoRouteForLayer(layer);
            }

            layer.simulation.running = true;
            layer.simulation.paused = false;
            layer.simulation.visitedPosts = 0;

            // Запускаем симуляцию для каждого слоя
            this.runLayerSimulation(layer);
        });

        this.updateStatus(`Симуляция запущена на ${layersWithRobots.length} слоях`);
    }

    async runLayerSimulation(layer) {
        const elements = layer.elements;
        const simulation = layer.simulation;

        if (!elements.robot || !elements.warehouse || simulation.postsToVisit.length === 0) {
            return;
        }

        let currentPostIndex = 0;

        while (currentPostIndex < simulation.postsToVisit.length && simulation.running && !simulation.paused) {
            const currentPost = simulation.postsToVisit[currentPostIndex];
            const warehouseNode = this.findClosestNodeInLayer(elements.warehouse, layer);
            const postNode = currentPost.node;

            if (!warehouseNode || !postNode) {
                currentPostIndex++;
                continue;
            }

            // Движение к посту
            const toPostPath = this.findShortestPathInLayer(warehouseNode, postNode, layer);
            if (toPostPath.length > 0) {
                await this.followPathInLayer(toPostPath, layer, elements.robot);
            }

            if (simulation.running && !simulation.paused) {
                // Остановка на посту
                currentPost.visited = true;
                simulation.visitedPosts++;
                this.updatePostsVisited();

                await this.delay((elements.robot.postStopTime || 30) * 1000);
            }

            if (simulation.running && !simulation.paused) {
                // Возврат на склад
                const toWarehousePath = this.findShortestPathInLayer(postNode, warehouseNode, layer);
                if (toWarehousePath.length > 0) {
                    await this.followPathInLayer(toWarehousePath, layer, elements.robot);
                }

                // Остановка на складе
                await this.delay((elements.robot.warehouseStopTime || 300) * 1000);
            }

            currentPostIndex++;
        }

        simulation.running = false;
        this.updateStatus(`Слой ${layer.name}: Все посты посещены!`);
    }

    generateAutoRouteForLayer(layer) {
        const elements = layer.elements;

        if (!elements.robot || !elements.warehouse || elements.posts.length === 0) {
            return;
        }

        const robotNode = this.findClosestNodeInLayer(elements.robot, layer);
        const warehouseNode = this.findClosestNodeInLayer(elements.warehouse, layer);

        if (!robotNode || !warehouseNode) {
            return;
        }

        const postsWithoutNodes = elements.posts.filter(post => !post.node);
        if (postsWithoutNodes.length > 0) {
            return;
        }

        const sortedPosts = [...elements.posts].sort((a, b) => {
            if (a.conveyor !== b.conveyor) return a.conveyor - b.conveyor;
            return a.number - b.number;
        });

        layer.simulation.postsToVisit = sortedPosts;
        layer.simulation.totalPosts = sortedPosts.length;
        layer.simulation.visitedPosts = 0;
    }

    findClosestNodeInLayer(element, layer) {
        const rect = element.getBoundingClientRect();
        const workshopRect = this.workshop.getBoundingClientRect();
        const x = rect.left - workshopRect.left + rect.width / 2;
        const y = rect.top - workshopRect.top + rect.height / 2;

        let closestNode = null;
        let minDistance = Infinity;

        layer.elements.pathNodes.forEach(node => {
            const distance = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
            if (distance < minDistance) {
                minDistance = distance;
                closestNode = node;
            }
        });

        return closestNode;
    }

    async visitNextPost() {
        const simulation = this.currentSimulation;
        const elements = this.currentElements;

        if (!simulation.running || simulation.paused) return;

        if (simulation.visitedPosts >= simulation.totalPosts) {
            simulation.running = false;
            this.updateStatus(`Слой ${this.currentLayer.name}: Все посты посещены!`);
            return;
        }

        const currentPost = simulation.postsToVisit[simulation.visitedPosts];
        const warehouseNode = this.findClosestNodeInLayer(elements.warehouse, this.currentLayer);
        const postNode = currentPost.node;

        if (!warehouseNode || !postNode) {
            simulation.visitedPosts++;
            setTimeout(() => this.visitNextPost(), 100);
            return;
        }

        const toPostPath = this.findShortestPathInLayer(warehouseNode, postNode, this.currentLayer);

        if (toPostPath.length === 0) {
            simulation.visitedPosts++;
            setTimeout(() => this.visitNextPost(), 100);
            return;
        }

        await this.followPathInLayer(toPostPath, this.currentLayer);

        if (simulation.running && !simulation.paused) {
            this.updateStatus(`Слой ${this.currentLayer.name}: Остановка на посту ${currentPost.conveyor}-${currentPost.number}`);
            currentPost.visited = true;
            simulation.visitedPosts++;
            this.updatePostsVisited();

            await this.delay((elements.robot.postStopTime || 30) * 1000);
        }

        if (simulation.running && !simulation.paused) {
            const toWarehousePath = this.findShortestPathInLayer(postNode, warehouseNode, this.currentLayer);

            if (toWarehousePath.length > 0) {
                await this.followPathInLayer(toWarehousePath, this.currentLayer);

                this.updateStatus(`Слой ${this.currentLayer.name}: Остановка на складе`);
                await this.delay((elements.robot.warehouseStopTime || 300) * 1000);
            }
        }

        if (simulation.running && !simulation.paused) {
            this.visitNextPost();
        }
    }

    async followPathInLayer(path, layer, robotElement) {
        const speed = robotElement.speed || 0.6;

        for (let i = 0; i < path.length - 1; i++) {
            if (!layer.simulation.running || layer.simulation.paused) break;

            const currentNode = path[i];
            const nextNode = path[i + 1];

            const connection = currentNode.connections.find(c => c.node === nextNode);
            if (!connection) {
                continue;
            }

            const timeMs = (connection.length / speed) * 1000;
            await this.moveRobotToInLayer(robotElement, nextNode.x, nextNode.y, timeMs);
        }
    }

    moveRobotToInLayer(robotElement, x, y, timeMs) {
        return new Promise((resolve) => {
            if (!this.currentSimulation.running || this.currentSimulation.paused) {
                resolve();
                return;
            }

            robotElement.style.transition = `left ${timeMs}ms linear, top ${timeMs}ms linear`;
            robotElement.style.left = x + 'px';
            robotElement.style.top = y + 'px';

            // Обновляем позицию робота
            this.updateRobotPosition(robotElement, { x, y });

            setTimeout(() => {
                resolve();
            }, timeMs);
        });
    }

    findShortestPathInLayer(startNode, endNode, layer) {
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();

        layer.elements.pathNodes.forEach(node => {
            distances.set(node, Infinity);
            previous.set(node, null);
            unvisited.add(node);
        });
        distances.set(startNode, 0);

        while (unvisited.size > 0) {
            let currentNode = null;
            let minDistance = Infinity;

            unvisited.forEach(node => {
                if (distances.get(node) < minDistance) {
                    minDistance = distances.get(node);
                    currentNode = node;
                }
            });

            if (currentNode === null || currentNode === endNode) break;

            unvisited.delete(currentNode);

            currentNode.connections.forEach(connection => {
                if (unvisited.has(connection.node)) {
                    const alt = distances.get(currentNode) + connection.length;
                    if (alt < distances.get(connection.node)) {
                        distances.set(connection.node, alt);
                        previous.set(connection.node, currentNode);
                    }
                }
            });
        }

        const path = [];
        let currentNode = endNode;

        while (currentNode !== null) {
            path.unshift(currentNode);
            currentNode = previous.get(currentNode);
        }

        return path;
    }

    resetAllMergedRobotsToWarehouses() {
        console.log('Resetting all merged robots to warehouses...');

        this.currentElements.mergedRobots.forEach(robotData => {
            // Находим склад для этого робота
            const warehouse = this.currentElements.mergedWarehouses.find(w => w.layerIndex === robotData.layerIndex);
            if (warehouse) {
                // Перемещаем робота на склад
                robotData.element.style.transition = 'none';
                robotData.element.style.left = warehouse.x + 'px';
                robotData.element.style.top = warehouse.y + 'px';

                // Обновляем позиции label и info
                this.updateRobotLabelPosition(robotData.element, robotData.label);
                robotData.infoElement.style.left = (warehouse.x + 20) + 'px';
                robotData.infoElement.style.top = (warehouse.y - 15) + 'px';

                console.log(`Reset robot ${robotData.layerIndex} to warehouse at (${warehouse.x}, ${warehouse.y})`);

                // Восстанавливаем transition после сброса
                setTimeout(() => {
                    robotData.element.style.transition = '';
                }, 50);
            }
        });
    }

    createIndependentSimulationData(robotData) {
        console.log('Creating independent simulation data for robot:', robotData.layerIndex);

        // Находим склад для этого робота
        const warehouse = this.currentElements.mergedWarehouses.find(w => w.layerIndex === robotData.layerIndex);
        if (!warehouse) {
            console.log('No warehouse found for robot:', robotData.layerIndex);
            return null;
        }

        // Находим узел склада
        const warehouseNode = this.findMergedNode(warehouse.element, robotData.layerIndex, this.currentLayer);
        if (!warehouseNode) {
            console.log('No warehouse node found for robot:', robotData.layerIndex);
            return null;
        }

        // Находим посты для этого слоя
        const layerPosts = this.currentElements.posts.filter(post =>
            post.layerIndex === robotData.layerIndex && post.node
        );

        if (layerPosts.length === 0) {
            console.log('No posts found for robot:', robotData.layerIndex);
            return null;
        }

        // Сортируем посты
        const sortedPosts = [...layerPosts].sort((a, b) => {
            if (a.conveyor !== b.conveyor) return a.conveyor - b.conveyor;
            return a.number - b.number;
        });

        console.log(`Created simulation data for robot ${robotData.layerIndex} with ${sortedPosts.length} posts`);

        return {
            robotNode: warehouseNode, // Робот стартует со склада
            warehouseNode: warehouseNode,
            posts: sortedPosts,
            currentPostIndex: 0,
            currentPath: [],
            isMoving: false,
            layerIndex: robotData.layerIndex,
            speed: robotData.speed || 0.6,
            postStopTime: robotData.postStopTime || 30,
            warehouseStopTime: robotData.warehouseStopTime || 300
        };
    }

    async runIndependentRobotSimulation(robotData) {
        // Инициализируем статистику для робота
        const robotId = `robot-${robotData.layerIndex}`;
        if (!this.statistics.robots[robotId]) {
            this.statistics.robots[robotId] = {
                deliveries: 0,
                distance: 0,
                postsVisited: 0,
                cyclesCompleted: 0
            };
        }

        const stats = this.statistics.robots[robotId];
        const simData = robotData.simulationData;

        if (!simData || simData.posts.length === 0) {
            console.log('No simulation data or posts for robot:', robotData.layerIndex);
            return;
        }

        console.log(`Starting independent simulation for robot ${robotData.layerIndex}`);

        // Основной цикл симуляции для этого робота
        while (this.currentSimulation.running && !this.currentSimulation.paused) {
            // Посещаем все посты по порядку
            for (let i = 0; i < simData.posts.length; i++) {
                if (!this.currentSimulation.running || this.currentSimulation.paused) break;

                const currentPost = simData.posts[i];

                if (!currentPost.node) {
                    console.log(`No node for post ${currentPost.conveyor}-${currentPost.number}, skipping`);
                    continue;
                }

                console.log(`Robot ${robotData.layerIndex} moving to post ${currentPost.conveyor}-${currentPost.number}`);

                // Движение от склада к посту
                const toPostPath = this.findShortestPath(simData.warehouseNode, currentPost.node);
                if (toPostPath.length > 0) {
                    // Считаем расстояние до поста
                    const pathDistance = this.calculatePathDistance(toPostPath);
                    await this.moveRobotAlongPath(robotData, toPostPath);

                    // Обновляем статистику расстояния
                    stats.distance += pathDistance;
                }

                if (this.currentSimulation.running && !this.currentSimulation.paused) {
                    // Остановка на посту
                    console.log(`Robot ${robotData.layerIndex} stopping at post ${currentPost.conveyor}-${currentPost.number}`);

                    // Учитываем ВСЕ настройки скорости для времени остановки
                    const actualPostStopTime = (simData.postStopTime * 1000) /
                        (this.timeSettings.globalSpeed * this.timeSettings.robotSpeed);
                    await this.delay(actualPostStopTime);

                    // Обновляем статистику посещений постов
                    stats.postsVisited++;
                    currentPost.visited = true;
                }

                if (this.currentSimulation.running && !this.currentSimulation.paused) {
                    // Возврат на склад
                    const toWarehousePath = this.findShortestPath(currentPost.node, simData.warehouseNode);
                    if (toWarehousePath.length > 0) {
                        // Считаем расстояние обратно на склад
                        const returnDistance = this.calculatePathDistance(toWarehousePath);
                        await this.moveRobotAlongPath(robotData, toWarehousePath);

                        // Обновляем статистику расстояния
                        stats.distance += returnDistance;
                    }

                    // Остановка на складе
                    console.log(`Robot ${robotData.layerIndex} stopping at warehouse`);

                    // Учитываем ВСЕ настройки скорости для времени остановки на складе
                    const actualWarehouseStopTime = (simData.warehouseStopTime * 1000) /
                        (this.timeSettings.globalSpeed * this.timeSettings.robotSpeed);
                    await this.delay(actualWarehouseStopTime);

                    // Обновляем статистику доставок
                    stats.deliveries++;
                }

                // Обновляем отображение статистики после каждого поста
                this.updateStatisticsDisplay();
            }

            // Завершили полный цикл (все посты)
            stats.cyclesCompleted++;

            // Обновляем статистику после завершения цикла
            this.updateStatisticsDisplay();

            console.log(`Robot ${robotData.layerIndex} completed cycle ${stats.cyclesCompleted}. ` +
                `Total: ${stats.deliveries} deliveries, ${stats.distance.toFixed(1)}m distance`);

            // Если симуляция все еще работает, начинаем новый цикл
            if (this.currentSimulation.running && !this.currentSimulation.paused) {
                console.log(`Robot ${robotData.layerIndex} starting new cycle`);
            }
        }

        console.log(`Robot ${robotData.layerIndex} simulation ended. Final stats: ` +
            `${stats.deliveries} deliveries, ${stats.distance.toFixed(1)}m distance, ` +
            `${stats.cyclesCompleted} cycles completed`);
        simData.isMoving = false;
    }

    // Добавьте метод для расчета расстояния пути
    calculatePathDistance(path) {
        let totalDistance = 0;

        for (let i = 0; i < path.length - 1; i++) {
            const currentNode = path[i];
            const nextNode = path[i + 1];

            const connection = currentNode.connections.find(c => c.node === nextNode);
            if (connection) {
                totalDistance += connection.length;
            } else {
                // Если соединение не найдено, вычисляем евклидово расстояние
                const dx = nextNode.x - currentNode.x;
                const dy = nextNode.y - currentNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy) / this.config.workshop.scale;
                totalDistance += distance;
            }
        }

        return totalDistance;
    }

    // Также обновите метод moveRobotAlongPath для учета настроек скорости:
    async moveRobotAlongPath(robotData, path) {
        for (let i = 0; i < path.length - 1; i++) {
            if (!this.currentSimulation.running || this.currentSimulation.paused) break;

            const currentNode = path[i];
            const nextNode = path[i + 1];

            const connection = currentNode.connections.find(c => c.node === nextNode);
            if (!connection) continue;

            // ПРИМЕНЯЕМ ВСЕ НАСТРОЙКИ СКОРОСТИ
            const actualSpeed = robotData.speed * this.timeSettings.globalSpeed * this.timeSettings.robotSpeed;
            const actualTimeMs = (connection.length / actualSpeed) * 1000;

            await this.moveRobotToPosition(robotData, nextNode.x, nextNode.y, actualTimeMs);
        }
    }

    updateStatisticsDisplay() {
        const cabinetsCount = document.getElementById('cabinets-count');
        const robotsStats = document.getElementById('robots-stats');

        if (cabinetsCount) {
            cabinetsCount.textContent = `Собрано шкафов: ${this.statistics.cabinetsProduced}`;
        }

        if (robotsStats) {
            let statsHTML = '<strong>Статистика роботов:</strong><br>';
            for (const [robotId, stats] of Object.entries(this.statistics.robots)) {
                statsHTML += `
                    ${robotId}: 
                    доставок: ${stats.deliveries}, 
                    дистанция: ${stats.distance.toFixed(1)}м,
                    постов: ${stats.postsVisited},
                    циклов: ${stats.cyclesCompleted}<br>`;
            }
            robotsStats.innerHTML = statsHTML;
        }
    }

    async moveRobotAlongPath(robotData, path) {
        console.log(`Robot ${robotData.layerIndex} moving along path with ${path.length} nodes`);

        for (let i = 0; i < path.length - 1; i++) {
            if (!this.currentSimulation.running || this.currentSimulation.paused) break;

            const currentNode = path[i];
            const nextNode = path[i + 1];

            // Находим соединение между узлами
            const connection = currentNode.connections.find(c => c.node === nextNode);
            if (!connection) {
                console.log(`No connection found between nodes for robot ${robotData.layerIndex}`);
                continue;
            }

            const timeMs = (connection.length / robotData.speed) * 1000;

            // Перемещаем робота к следующему узлу
            await this.moveRobotToPosition(robotData, nextNode.x, nextNode.y, timeMs);
        }
    }

    moveRobotToPosition(robotData, x, y, timeMs) {
        return new Promise((resolve) => {
            if (!this.currentSimulation.running || this.currentSimulation.paused) {
                resolve();
                return;
            }

            robotData.element.style.transition = `left ${timeMs}ms linear, top ${timeMs}ms linear`;
            robotData.element.style.left = x + 'px';
            robotData.element.style.top = y + 'px';

            // Обновляем позиции label и info
            this.updateRobotLabelPosition(robotData.element, robotData.label);
            robotData.infoElement.style.left = (x + 20) + 'px';
            robotData.infoElement.style.top = (y - 15) + 'px';

            setTimeout(() => {
                resolve();
            }, timeMs);
        });
    }

    startMergedSimulation() {
        if (!this.currentElements.mergedRobots || this.currentElements.mergedRobots.length === 0) {
            alert('Нет роботов для симуляции!');
            return;
        }

        this.currentSimulation.running = true;
        this.currentSimulation.paused = false;

        // Сбрасываем всех роботов на их склады
        this.resetAllMergedRobotsToWarehouses();

        let activeRobots = 0;

        // Запускаем независимые симуляции для каждого робота
        this.currentElements.mergedRobots.forEach(robotData => {
            const simulationData = this.createIndependentSimulationData(robotData);
            if (simulationData) {
                robotData.simulationData = simulationData;
                robotData.simulationData.currentPostIndex = 0;
                robotData.simulationData.isMoving = false;
                activeRobots++;

                // Запускаем симуляцию для этого робота
                this.runIndependentRobotSimulation(robotData);
            }
        });

        if (activeRobots === 0) {
            alert('Нет роботов с валидными маршрутами для симуляции!');
            this.currentSimulation.running = false;
            return;
        }

        this.updateStatus(`Совмещенная симуляция запущена для ${activeRobots} роботов`);
    }

    async runSingleMergedRobot(robotData) {
        const simData = robotData.simulationData;

        while (simData.currentPostIndex < simData.posts.length &&
            this.currentSimulation.running && !this.currentSimulation.paused) {

            const currentPost = simData.posts[simData.currentPostIndex];

            const postNode = this.currentElements.pathNodes.find(n =>
                n.layerIndex === simData.layerIndex &&
                Math.abs(n.x - currentPost.x) < 5 &&
                Math.abs(n.y - currentPost.y) < 5
            );

            if (!postNode) {
                simData.currentPostIndex++;
                continue;
            }

            // Движение к посту
            const toPostPath = this.findShortestPath(simData.warehouseNode, postNode);
            if (toPostPath.length > 0) {
                await this.moveMergedRobotAlongPath(robotData, toPostPath);
            }

            if (this.currentSimulation.running && !this.currentSimulation.paused) {
                // Остановка на посту
                await this.delay(simData.postStopTime * 1000);
            }

            if (this.currentSimulation.running && !this.currentSimulation.paused) {
                // Возврат на склад
                const toWarehousePath = this.findShortestPath(postNode, simData.warehouseNode);
                if (toWarehousePath.length > 0) {
                    await this.moveMergedRobotAlongPath(robotData, toWarehousePath);
                }

                // Остановка на складе
                await this.delay(simData.warehouseStopTime * 1000);
            }

            simData.currentPostIndex++;
        }

        robotData.simulationData.isMoving = false;
    }

    async moveMergedRobotAlongPath(robotData, path) {
        for (let i = 0; i < path.length - 1; i++) {
            if (!this.currentSimulation.running || this.currentSimulation.paused) break;

            const currentNode = path[i];
            const nextNode = path[i + 1];

            const connection = currentNode.connections.find(c => c.node === nextNode);
            const distance = connection ? connection.length :
                Math.sqrt(Math.pow(nextNode.x - currentNode.x, 2) + Math.pow(nextNode.y - currentNode.y, 2)) / this.config.workshop.scale;

            const timeMs = (distance / robotData.speed) * 1000;

            await this.moveRobotElementTo(robotData.element, robotData.label, nextNode.x, nextNode.y, timeMs);
        }
    }

    async runMergedSimulation() {
        while (this.currentSimulation.running && !this.currentSimulation.paused) {
            let anyRobotActive = false;

            for (let i = 0; i < this.currentElements.mergedRobots.length; i++) {
                const robotData = this.currentElements.mergedRobots[i];

                if (robotData.simulationData &&
                    robotData.simulationData.currentPostIndex < robotData.simulationData.posts.length) {

                    anyRobotActive = true;

                    if (!robotData.simulationData.isMoving) {
                        robotData.simulationData.isMoving = true;
                        await this.runSingleRobotSimulation(robotData, i);
                    }
                }
            }

            if (!anyRobotActive) {
                this.currentSimulation.running = false;
                this.updateStatus('Все роботы завершили свои маршруты!');
                break;
            }

            await this.delay(50);
        }
    }

    async runSingleRobotSimulation(robotData, robotIndex) {
        const simData = robotData.simulationData;

        while (simData.currentPostIndex < simData.posts.length &&
            this.currentSimulation.running && !this.currentSimulation.paused) {

            const currentPost = simData.posts[simData.currentPostIndex];

            const postNode = this.currentElements.pathNodes.find(n =>
                n.layerIndex === simData.layerIndex &&
                Math.abs(n.x - currentPost.x) < 5 &&
                Math.abs(n.y - currentPost.y) < 5
            );

            if (!postNode) {
                simData.currentPostIndex++;
                continue;
            }

            const toPostPath = this.findShortestPath(simData.warehouseNode, postNode);
            if (toPostPath.length > 0) {
                await this.moveMergedRobot(robotIndex, toPostPath, simData.speed);

                if (this.currentSimulation.running && !this.currentSimulation.paused) {
                    await this.delay(simData.postStopTime * 1000);
                }
            }

            const toWarehousePath = this.findShortestPath(postNode, simData.warehouseNode);
            if (toWarehousePath.length > 0) {
                await this.moveMergedRobot(robotIndex, toWarehousePath, simData.speed);

                if (this.currentSimulation.running && !this.currentSimulation.paused) {
                    await this.delay(simData.warehouseStopTime * 1000);
                }
            }

            simData.currentPostIndex++;
        }

        robotData.simulationData.isMoving = false;
    }

    async moveMergedRobot(robotIndex, path, speed) {
        const robotData = this.currentElements.mergedRobots[robotIndex];

        for (let i = 0; i < path.length - 1; i++) {
            if (!this.currentSimulation.running || this.currentSimulation.paused) break;

            const currentNode = path[i];
            const nextNode = path[i + 1];

            const connection = currentNode.connections.find(c => c.node === nextNode);
            if (!connection) {
                const distance = Math.sqrt(Math.pow(nextNode.x - currentNode.x, 2) + Math.pow(nextNode.y - currentNode.y, 2));
                const timeMs = (distance / this.config.workshop.scale / speed) * 1000;
                await this.moveRobotElementTo(robotData.element, robotData.label, nextNode.x, nextNode.y, timeMs);
            } else {
                const timeMs = (connection.length / speed) * 1000;
                await this.moveRobotElementTo(robotData.element, robotData.label, nextNode.x, nextNode.y, timeMs);
            }
        }
    }

    moveRobotElementTo(robotElement, labelElement, x, y, timeMs) {
        return new Promise((resolve) => {
            if (!this.currentSimulation.running || this.currentSimulation.paused) {
                resolve();
                return;
            }

            robotElement.style.transition = `left ${timeMs}ms linear, top ${timeMs}ms linear`;
            robotElement.style.left = x + 'px';
            robotElement.style.top = y + 'px';

            const updateLabel = () => {
                this.updateRobotLabelPosition(robotElement, labelElement);
            };

            updateLabel();
            setTimeout(updateLabel, timeMs);

            setTimeout(() => {
                resolve();
            }, timeMs);
        });
    }

    findShortestPath(startNode, endNode) {
        // Простая проверка - если узлы из разных слоев, возвращаем пустой путь
        if (startNode.layerIndex !== undefined && endNode.layerIndex !== undefined &&
            startNode.layerIndex !== endNode.layerIndex) {
            return [];
        }

        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();

        // Фильтруем узлы только из того же слоя
        const layerNodes = this.currentElements.pathNodes.filter(node =>
            node.layerIndex === startNode.layerIndex
        );

        layerNodes.forEach(node => {
            distances.set(node, Infinity);
            previous.set(node, null);
            unvisited.add(node);
        });
        distances.set(startNode, 0);

        while (unvisited.size > 0) {
            let currentNode = null;
            let minDistance = Infinity;

            unvisited.forEach(node => {
                if (distances.get(node) < minDistance) {
                    minDistance = distances.get(node);
                    currentNode = node;
                }
            });

            if (currentNode === null || currentNode === endNode) break;

            unvisited.delete(currentNode);

            currentNode.connections.forEach(connection => {
                if (unvisited.has(connection.node)) {
                    const alt = distances.get(currentNode) + connection.length;
                    if (alt < distances.get(connection.node)) {
                        distances.set(connection.node, alt);
                        previous.set(connection.node, currentNode);
                    }
                }
            });
        }

        const path = [];
        let currentNode = endNode;

        while (currentNode !== null) {
            path.unshift(currentNode);
            currentNode = previous.get(currentNode);
        }

        return path;
    }

    generateAutoRoute() {
        if (this.currentLayerId.startsWith('merged-')) {
            if (!this.currentElements.mergedRobots || this.currentElements.mergedRobots.length === 0) {
                alert('Для автоматического маршрута нужны роботы!');
                return;
            }

            let routesGenerated = 0;
            this.currentElements.mergedRobots.forEach(robotData => {
                const sourceLayer = this.layers[robotData.layerId];
                if (sourceLayer && sourceLayer.elements.warehouse && sourceLayer.elements.posts.length > 0) {
                    // Убедимся, что у постов есть узлы
                    const postsWithNodes = sourceLayer.elements.posts.filter(post => post.node);
                    if (postsWithNodes.length > 0) {
                        robotData.simulationData = this.prepareMergedSimulationData(sourceLayer, robotData.layerIndex, this.currentLayer);
                        if (robotData.simulationData) {
                            routesGenerated++;
                            console.log('Auto route generated for robot in layer:', robotData.layerIndex);
                        }
                    }
                }
            });

            this.updateStatus(`Автомаршруты сгенерированы для ${routesGenerated} роботов`);
            return;
        }

        if (!this.currentElements.robot || !this.currentElements.warehouse) {
            alert('Для автоматического маршрута нужны робот и склад!');
            return;
        }

        if (this.currentElements.posts.length === 0) {
            alert('Добавьте хотя бы один пост!');
            return;
        }

        if (this.currentElements.pathNodes.length < 2) {
            alert('Создайте узлы пути и соедините их!');
            return;
        }

        const robotNode = this.findClosestNode(this.currentElements.robot);
        const warehouseNode = this.findClosestNode(this.currentElements.warehouse);

        if (!robotNode || !warehouseNode) {
            alert('Не найдены узлы пути для робота или склада!');
            return;
        }

        const postsWithoutNodes = this.currentElements.posts.filter(post => !post.node);
        if (postsWithoutNodes.length > 0) {
            alert('Некоторые посты не имеют узлов пути!');
            return;
        }

        const sortedPosts = [...this.currentElements.posts].sort((a, b) => {
            if (a.conveyor !== b.conveyor) return a.conveyor - b.conveyor;
            return a.number - b.number;
        });

        this.currentSimulation.postsToVisit = sortedPosts;
        this.currentSimulation.totalPosts = sortedPosts.length;
        this.currentSimulation.visitedPosts = 0;

        this.updatePostsVisited();
        this.updateStatus(`Автомаршрут сгенерирован для ${this.currentSimulation.totalPosts} постов`);
    }

    findClosestNode(element) {
        const rect = element.getBoundingClientRect();
        const workshopRect = this.workshop.getBoundingClientRect();
        const x = rect.left - workshopRect.left + rect.width / 2;
        const y = rect.top - workshopRect.top + rect.height / 2;

        let closestNode = null;
        let minDistance = Infinity;

        this.currentElements.pathNodes.forEach(node => {
            const distance = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
            if (distance < minDistance) {
                minDistance = distance;
                closestNode = node;
            }
        });

        return closestNode;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stopSimulation() {
        if (this.currentSimulation.running) {
            this.currentSimulation.running = false;
            this.currentSimulation.paused = false;

            if (this.currentElements.robot) {
                const computedStyle = window.getComputedStyle(this.currentElements.robot);
                const currentLeft = parseFloat(computedStyle.left);
                const currentTop = parseFloat(computedStyle.top);

                this.currentElements.robot.style.transition = 'none';
                this.currentElements.robot.style.left = currentLeft + 'px';
                this.currentElements.robot.style.top = currentTop + 'px';
            }

            if (this.currentElements.mergedRobots) {
                this.currentElements.mergedRobots.forEach(robotData => {
                    if (robotData.simulationData) {
                        robotData.simulationData.isMoving = false;
                    }
                    if (robotData.element) {
                        robotData.element.style.transition = 'none';
                    }
                });
            }

            if (this.currentSimulation.currentAnimation) {
                clearTimeout(this.currentSimulation.currentAnimation);
            }

            this.updateStatus('Симуляция остановлена');
        }
    }

    resumeSimulation() {
        if (this.currentLayerId.startsWith('merged-')) {
            if (this.currentSimulation.running && this.currentSimulation.paused) {
                this.currentSimulation.paused = false;
                this.updateStatus('Симуляция возобновлена');
                this.runMergedSimulation();
            }
        } else {
            if (this.currentSimulation.running && this.currentSimulation.paused) {
                this.currentSimulation.paused = false;

                if (this.currentElements.robot) {
                    this.currentElements.robot.style.transition = '';
                }

                this.updateStatus('Симуляция возобновлена');
                this.visitNextPost();
            }
        }
    }

    resetSimulation() {
        this.currentSimulation.running = false;
        this.currentSimulation.paused = false;
        this.currentSimulation.visitedPosts = 0;

        this.currentElements.posts.forEach(post => post.visited = false);

        if (this.currentElements.robot && this.currentElements.warehouse) {
            const warehouseNode = this.findClosestNode(this.currentElements.warehouse);
            if (warehouseNode) {
                this.currentElements.robot.style.transition = 'none';
                this.currentElements.robot.style.left = warehouseNode.x + 'px';
                this.currentElements.robot.style.top = warehouseNode.y + 'px';

                setTimeout(() => {
                    this.currentElements.robot.style.transition = '';
                }, 50);
            }
        }
        if (this.currentLayerId.startsWith('merged-')) {
            this.resetAllMergedRobotsToWarehouses();

            if (this.currentElements.mergedRobots) {
                this.currentElements.mergedRobots.forEach(robotData => {
                    if (robotData.simulationData) {
                        robotData.simulationData.currentPostIndex = 0;
                        robotData.simulationData.isMoving = false;
                    }
                });
            }
            return;
        }

        if (this.currentElements.mergedRobots) {
            this.currentElements.mergedRobots.forEach(robotData => {
                if (robotData.simulationData) {
                    robotData.simulationData.currentPostIndex = 0;
                    robotData.simulationData.isMoving = false;

                    const originalLayer = this.layers[robotData.layerId];
                    if (originalLayer && originalLayer.elements.warehouse) {
                        const warehouseNode = this.findClosestNode(originalLayer.elements.warehouse);
                        if (warehouseNode) {
                            const mergedNode = this.currentElements.pathNodes.find(n =>
                                n.originalNode === warehouseNode && n.layerIndex === robotData.layerIndex
                            );
                            if (mergedNode) {
                                robotData.element.style.transition = 'none';
                                robotData.element.style.left = mergedNode.x + 'px';
                                robotData.element.style.top = mergedNode.y + 'px';
                                this.updateRobotLabelPosition(robotData.element, robotData.label);

                                setTimeout(() => {
                                    robotData.element.style.transition = '';
                                }, 50);
                            }
                        }
                    }
                }
            });
        }

        this.updateStatus('Симуляция сброшена');
        this.updatePostsVisited();
    }

    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    updateRobotStatus(position) {
        const robotStatus = document.getElementById('robot-status');
        const currentPosition = document.getElementById('current-position');

        if (robotStatus) robotStatus.textContent = 'Робот движется';
        if (currentPosition) {
            currentPosition.textContent = `Позиция: X: ${Math.round(position.x)}, Y: ${Math.round(position.y)}`;
        }
    }

    updateRobotPosition(robotElement, position) {
        const currentPosition = document.getElementById('current-position');
        if (currentPosition && robotElement === this.currentElements.robot) {
            currentPosition.textContent = `Позиция: X: ${Math.round(position.x)}, Y: ${Math.round(position.y)}`;
        }
    }

    updatePostsVisited() {
        const postsVisited = document.getElementById('posts-visited');
        if (postsVisited) {
            postsVisited.textContent = `Посещено постов: ${this.currentSimulation.visitedPosts}/${this.currentSimulation.totalPosts}`;
        }
    }

    saveConfiguration() {
        // Создаем очищенную версию данных для сохранения
        const saveData = {
            config: this.config,
            layers: this.serializeLayersForSave(),
            currentLayerId: this.currentLayerId,
            timestamp: new Date().toISOString()
        };
    
        console.log('Saving configuration:', saveData);
    
        fetch('save_config.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(saveData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Конфигурация успешно сохранена!');
            } else {
                alert('Ошибка при сохранении: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Ошибка сохранения:', error);
            alert('Ошибка при сохранении конфигурации');
        });
    }

    loadConfiguration() {
        fetch('saved_config.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Файл конфигурации не найден');
                }
                return response.json();
            })
            .then(data => {
                this.loadConfigurationData(data);
            })
            .catch(error => {
                console.log('Ошибка при загрузке конфигурации:', error);
                alert('Не удалось загрузить конфигурацию: ' + error.message);
            });
    }

    loadConfigurationData(data) {
        if (!data || !data.layers) {
            console.error('Invalid configuration data');
            alert('Некорректные данные конфигурации');
            return;
        }
    
        // Останавливаем текущую симуляцию
        this.stopSimulation();
    
        // Сохраняем текущий ID слоя
        const previousLayerId = this.currentLayerId;
    
        // Полностью очищаем все слои
        this.layers = {};
        this.layerCounter = 0;
    
        // Воссоздаем структуру слоев
        Object.keys(data.layers).forEach(layerId => {
            const layerData = data.layers[layerId];
            
            this.layers[layerId] = {
                id: layerId,
                name: layerData.name,
                visible: layerData.visible,
                elements: {
                    robot: null,
                    warehouse: null,
                    conveyors: [],
                    posts: [],
                    pathNodes: [],
                    pathLines: [],
                    mergedRobots: [],
                    mergedWarehouses: []
                },
                simulation: {
                    running: false,
                    paused: false,
                    currentPath: [],
                    currentTargetIndex: 0,
                    currentAnimation: null,
                    postsToVisit: [],
                    visitedPosts: layerData.simulation?.visitedPosts || 0,
                    totalPosts: layerData.simulation?.totalPosts || 0
                }
            };
        });
    
        // Устанавливаем счетчик слоев
        this.layerCounter = Object.keys(this.layers).length;
    
        // Переключаемся на сохраненный слой или первый доступный
        this.currentLayerId = data.currentLayerId || Object.keys(this.layers)[0] || 'layer-0';
    
        // Очищаем workshop
        this.workshop.innerHTML = '';
        
        // Восстанавливаем snap points
        this.createSnapPoints();
    
        // Восстанавливаем элементы для каждого слоя
        Object.keys(data.layers).forEach(layerId => {
            this.restoreLayerElements(layerId, data.layers[layerId].elements);
        });
    
        // Переключаемся на целевой слой (это перерисует элементы)
        this.switchLayer(this.currentLayerId);
    
        // Обновляем UI
        this.updateLayerSelect();
        this.updateLayerDisplay();
    
        console.log('Configuration loaded successfully for layer:', this.currentLayerId);
        this.updateStatus('Конфигурация успешно загружена');
    }
    restoreLayerElements(layerId, elementsData) {
        const layer = this.layers[layerId];
        if (!layer) {
            console.error('Layer not found:', layerId);
            return;
        }
    
        console.log('Restoring elements for layer:', layerId, elementsData);
    
        // Временно переключаемся на этот слой для восстановления элементов
        const previousLayerId = this.currentLayerId;
        this.currentLayerId = layerId;
    
        // Инициализируем массивы для совмещенных элементов
        if (!this.currentElements.mergedRobots) {
            this.currentElements.mergedRobots = [];
        }
        if (!this.currentElements.mergedWarehouses) {
            this.currentElements.mergedWarehouses = [];
        }
    
        // Восстанавливаем обычные элементы (для обычных слоев)
        if (elementsData.robot && !layerId.startsWith('merged-')) {
            this.restoreRobot(elementsData.robot);
        }
    
        if (elementsData.warehouse && !layerId.startsWith('merged-')) {
            this.restoreWarehouse(elementsData.warehouse);
        }
    
        // Восстанавливаем совмещенные элементы (для совмещенных слоев)
        if (elementsData.mergedRobots && layerId.startsWith('merged-')) {
            console.log('Restoring merged robots:', elementsData.mergedRobots.length);
            elementsData.mergedRobots.forEach(robotData => {
                this.restoreMergedRobot(robotData);
            });
        }
    
        if (elementsData.mergedWarehouses && layerId.startsWith('merged-')) {
            console.log('Restoring merged warehouses:', elementsData.mergedWarehouses.length);
            elementsData.mergedWarehouses.forEach(warehouseData => {
                this.restoreMergedWarehouse(warehouseData);
            });
        }
    
        // Восстанавливаем общие элементы
        if (elementsData.posts && elementsData.posts.length > 0) {
            elementsData.posts.forEach(postData => {
                this.restorePost(postData);
            });
        }
    
        if (elementsData.pathNodes && elementsData.pathNodes.length > 0) {
            elementsData.pathNodes.forEach(nodeData => {
                this.restorePathNode(nodeData);
            });
        }
    
        if (elementsData.conveyors && elementsData.conveyors.length > 0) {
            this.restoreConveyors(elementsData.conveyors);
        }
    
        if (elementsData.pathLines && elementsData.pathLines.length > 0) {
            elementsData.pathLines.forEach(lineData => {
                this.restorePathLine(lineData);
            });
        }
    
        // Возвращаемся к предыдущему слою
        this.currentLayerId = previousLayerId;
    }
    restoreMergedRobot(robotData) {
        console.log('Restoring merged robot:', robotData);
    
        const robot = document.createElement('div');
        robot.className = 'element robot robot-merged';
        robot.style.left = robotData.x + 'px';
        robot.style.top = robotData.y + 'px';
        robot.style.width = '40px';
        robot.style.height = '40px';
        
        // Используем сохраненный цвет или генерируем новый
        const color = robotData.color || this.getColorByLayerIndex(robotData.layerIndex);
        robot.style.border = `3px solid ${color}`;
        robot.style.borderRadius = '50%';
        robot.style.zIndex = 20 + (robotData.layerIndex || 0);
        robot.style.background = 'rgba(255, 255, 255, 0.8)';
    
        // Используем соответствующее изображение
        const robotImage = robotData.type === 'bigRobot'
            ? this.config.images.bigRobot
            : this.config.images.robot;
    
        robot.innerHTML = `<img src="${robotImage}" alt="Робот" style="width:100%;height:100%;border-radius:50%;">`;
    
        const label = document.createElement('div');
        label.className = 'robot-label';
        label.textContent = `Робот ${(robotData.layerIndex || 0) + 1} (С${(robotData.layerIndex || 0) + 1})`;
        label.style.cssText = `
            position: absolute;
            background: ${color};
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            white-space: nowrap;
            pointer-events: none;
            z-index: 30;
            font-weight: bold;
        `;
    
        const info = document.createElement('div');
        info.className = 'robot-info';
        info.textContent = `v=${robotData.speed || 0.6}m/s`;
        info.style.cssText = `
            position: absolute;
            background: white;
            padding: 2px 6px;
            border: 1px solid ${color};
            border-radius: 3px;
            font-size: 10px;
            pointer-events: none;
            z-index: 11;
            white-space: nowrap;
        `;
    
        const robotObj = {
            element: robot,
            label: label,
            infoElement: info,
            layerId: robotData.layerId || `layer-${robotData.layerIndex || 0}`,
            layerIndex: robotData.layerIndex || 0,
            color: color,
            speed: robotData.speed || 0.6,
            postStopTime: robotData.postStopTime || 30,
            warehouseStopTime: robotData.warehouseStopTime || 300,
            type: robotData.type || 'robot',
            simulationData: null
        };
    
        this.workshop.appendChild(robot);
        this.workshop.appendChild(label);
        this.workshop.appendChild(info);
    
        // Обновляем позиции
        this.updateRobotLabelPosition(robot, label);
        info.style.left = (robotData.x + 20) + 'px';
        info.style.top = (robotData.y - 15) + 'px';
    
        // Инициализируем массив если его нет
        if (!this.currentElements.mergedRobots) {
            this.currentElements.mergedRobots = [];
        }
        
        this.currentElements.mergedRobots.push(robotObj);
        console.log('Merged robot restored successfully');
    }

    getColorByLayerIndex(layerIndex) {
        const colors = ['#007bff', '#dc3545', '#28a745', '#ffc107', '#17a2b8', '#6f42c1'];
        return colors[layerIndex % colors.length];
    }
    
    restoreMergedWarehouse(warehouseData) {
        console.log('Restoring merged warehouse:', warehouseData);
    
        const warehouse = document.createElement('div');
        warehouse.className = 'element warehouse';
        warehouse.style.left = warehouseData.x + 'px';
        warehouse.style.top = warehouseData.y + 'px';
        warehouse.innerHTML = `<img src="${this.config.images.warehouse}" alt="Склад" style="width:100%;height:100%;">`;
    
        const warehouseObj = {
            element: warehouse,
            x: warehouseData.x,
            y: warehouseData.y,
            layerIndex: warehouseData.layerIndex || 0
        };
    
        this.workshop.appendChild(warehouse);
    
        // Инициализируем массив если его нет
        if (!this.currentElements.mergedWarehouses) {
            this.currentElements.mergedWarehouses = [];
        }
        
        this.currentElements.mergedWarehouses.push(warehouseObj);
        console.log('Merged warehouse restored successfully');
    }
    restorePost(postData) {
        const post = document.createElement('div');
        post.className = 'element post';
        post.style.left = postData.x + 'px';
        post.style.top = postData.y + 'px';
    
        const postImage = postData.type === 'uis'
            ? this.config.images.uis
            : this.config.images.post;
    
        post.innerHTML = `<img src="${postImage}" alt="${postData.type === 'uis' ? 'УИС' : 'Пост'}" style="width:100%;height:100%;">`;
        post.dataset.postType = postData.type;
    
        this.workshop.appendChild(post);
    
        const info = document.createElement('div');
        info.className = 'post-info';
        info.style.left = (postData.x + 20) + 'px';
        info.style.top = (postData.y - 15) + 'px';
        
        if (postData.type === 'uis') {
            info.textContent = `УИС${postData.number}`;
        } else {
            info.textContent = `${postData.conveyor}-${postData.number}`;
        }
    
        this.workshop.appendChild(info);
    
        const postObj = {
            element: post,
            infoElement: info,
            x: postData.x,
            y: postData.y,
            type: postData.type,
            conveyor: postData.conveyor,
            number: postData.number,
            visited: false
        };
    
        this.currentElements.posts.push(postObj);
    
        // Создаем узел для поста
        const postNode = this.placePathNode(postData.x, postData.y);
        postObj.node = postNode;
    }
    restorePathNode(nodeData) {
        // Проверяем, существует ли уже узел в этой позиции
        const existingNode = this.currentElements.pathNodes.find(node => 
            Math.abs(node.x - nodeData.x) < 5 && Math.abs(node.y - nodeData.y) < 5
        );
    
        if (existingNode) {
            return existingNode;
        }
    
        const node = document.createElement('div');
        node.className = 'path-node';
        node.style.left = nodeData.x + 'px';
        node.style.top = nodeData.y + 'px';
    
        node.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.selectedTool === 'path') {
                this.connectToNode(node);
            }
        });
    
        this.workshop.appendChild(node);
    
        const nodeObj = {
            element: node,
            x: nodeData.x,
            y: nodeData.y,
            connections: []
        };
    
        this.currentElements.pathNodes.push(nodeObj);
        return nodeObj;
    }
    restoreConveyors(conveyorsData) {
        // Группируем конвейеры по systemId
        const systems = {};
        conveyorsData.forEach(conv => {
            if (!systems[conv.systemId]) {
                systems[conv.systemId] = [];
            }
            systems[conv.systemId].push(conv);
        });
        
        // Восстанавливаем каждую систему конвейеров
        Object.keys(systems).forEach(systemId => {
            const segments = systems[systemId];
            if (segments.length > 0) {
                const firstSegment = segments[0];
                this.createConveyorSystem(firstSegment.x, firstSegment.y, systemId, 5400000);
            }
        });
    }
    restorePathLine(lineData) {
        // Находим начальный и конечный узлы
        const startNode = this.currentElements.pathNodes.find(node => 
            Math.abs(node.x - lineData.startX) < 5 && Math.abs(node.y - lineData.startY) < 5
        );
        
        const endNode = this.currentElements.pathNodes.find(node => 
            Math.abs(node.x - lineData.endX) < 5 && Math.abs(node.y - lineData.endY) < 5
        );
    
        if (!startNode || !endNode) {
            console.warn('Could not find nodes for path line:', lineData);
            return;
        }
    
        // Создаем линию
        const line = document.createElement('div');
        line.className = 'path-line';
    
        const visualLength = Math.sqrt(
            Math.pow(endNode.x - startNode.x, 2) + Math.pow(endNode.y - startNode.y, 2)
        );
        const angle = Math.atan2(endNode.y - startNode.y, endNode.x - startNode.x) * 180 / Math.PI;
    
        line.style.width = visualLength + 'px';
        line.style.left = startNode.x + 'px';
        line.style.top = startNode.y + 'px';
        line.style.transform = `rotate(${angle}deg)`;
    
        this.workshop.appendChild(line);
    
        // Создаем соединение
        const connectionData = {
            node: endNode,
            lineElement: line,
            length: lineData.length
        };
    
        startNode.connections.push(connectionData);
        endNode.connections.push({
            node: startNode,
            lineElement: line,
            length: lineData.length
        });
    
        const lineObj = {
            element: line,
            startNode: startNode,
            endNode: endNode,
            length: lineData.length,
            labelElement: null
        };
    
        this.currentElements.pathLines.push(lineObj);
    
        // Создаем label для линии
        this.updateLineLengthDisplay(lineObj);
    }

    restoreWarehouse(warehouseData) {
        const warehouse = document.createElement('div');
        warehouse.className = 'element warehouse';
        warehouse.style.left = warehouseData.x + 'px';
        warehouse.style.top = warehouseData.y + 'px';
        warehouse.innerHTML = `<img src="${this.config.images.warehouse}" alt="Склад" style="width:100%;height:100%;">`;
    
        this.workshop.appendChild(warehouse);
        this.currentElements.warehouse = warehouse;
    
        // Создаем узел для склада
        this.placePathNode(warehouseData.x, warehouseData.y);
    }
    restoreRobot(robotData) {
        const robot = document.createElement('div');
        robot.className = 'element robot';
        robot.style.left = robotData.x + 'px';
        robot.style.top = robotData.y + 'px';
    
        const robotImage = robotData.type === 'bigRobot'
            ? this.config.images.bigRobot
            : this.config.images.robot;
    
        robot.innerHTML = `<img src="${robotImage}" alt="Робот" style="width:100%;height:100%;">`;
        robot.dataset.robotType = robotData.type;
    
        this.workshop.appendChild(robot);
        this.currentElements.robot = robot;
    
        // Создаем информационный элемент
        const info = document.createElement('div');
        info.className = 'robot-info';
        info.style.left = (robotData.x + 20) + 'px';
        info.style.top = (robotData.y - 15) + 'px';
        info.textContent = `v=${robotData.speed}m/s`;
        info.style.cssText = `
            position: absolute;
            background: white;
            padding: 2px 6px;
            border: 1px solid #007bff;
            border-radius: 3px;
            font-size: 10px;
            pointer-events: none;
            z-index: 11;
            white-space: nowrap;
        `;
    
        this.workshop.appendChild(info);
    
        // Сохраняем данные робота
        this.currentElements.robot.speed = robotData.speed;
        this.currentElements.robot.postStopTime = robotData.postStopTime;
        this.currentElements.robot.warehouseStopTime = robotData.warehouseStopTime;
        this.currentElements.robot.infoElement = info;
        this.currentElements.robot.type = robotData.type;
    
        // Создаем узел для робота
        this.placePathNode(robotData.x, robotData.y);
    }

    debugMergedLayers() {
        console.log('=== DEBUG MERGED LAYERS ===');
        console.log('Current layer:', this.currentLayerId);
        console.log('All layers:', Object.keys(this.layers));

        if (this.currentLayerId.startsWith('merged-')) {
            console.log('Merged layer elements:');
            console.log('Robots:', this.currentElements.mergedRobots?.length || 0);
            console.log('Warehouses:', this.currentElements.mergedWarehouses?.length || 0);
            console.log('Path nodes:', this.currentElements.pathNodes.length);
            console.log('Path lines:', this.currentElements.pathLines.length);
            console.log('Posts:', this.currentElements.posts.length);

            // Проверяем узлы для каждого робота
            this.currentElements.mergedRobots?.forEach((robot, index) => {
                console.log(`Robot ${index}:`, {
                    layerId: robot.layerId,
                    layerIndex: robot.layerIndex,
                    position: {
                        x: robot.element.style.left,
                        y: robot.element.style.top
                    },
                    simulationData: robot.simulationData
                });
            });
        }

        console.log('=== END DEBUG ===');
    }
    debugNodes() {
        console.log('=== DEBUG ALL NODES ===');
        Object.values(this.layers).forEach(layer => {
            console.log(`Layer ${layer.id}:`);
            console.log('  Path nodes:', layer.elements.pathNodes.length);
            layer.elements.pathNodes.forEach((node, index) => {
                console.log(`    Node ${index}: (${node.x}, ${node.y}) layerIndex: ${node.layerIndex}`);
            });
        });
        console.log('=== END DEBUG ===');
    }
    debugElementPositions() {
        console.log('=== DEBUG ELEMENT POSITIONS ===');
        Object.values(this.layers).forEach(layer => {
            console.log(`Layer ${layer.id}:`);

            if (layer.elements.robot) {
                console.log('  Robot:', {
                    styleLeft: layer.elements.robot.style.left,
                    styleTop: layer.elements.robot.style.top,
                    boundingRect: layer.elements.robot.getBoundingClientRect()
                });
            }

            if (layer.elements.warehouse) {
                console.log('  Warehouse:', {
                    styleLeft: layer.elements.warehouse.style.left,
                    styleTop: layer.elements.warehouse.style.top,
                    boundingRect: layer.elements.warehouse.getBoundingClientRect()
                });
            }

            layer.elements.posts.forEach((post, index) => {
                console.log(`  Post ${index}:`, {
                    styleLeft: post.element.style.left,
                    styleTop: post.element.style.top,
                    boundingRect: post.element.getBoundingClientRect(),
                    hasNode: !!post.node
                });
            });
        });
        console.log('=== END DEBUG ===');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RobotSimulation(config);
});