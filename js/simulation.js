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

        // Система слоев
        this.layers = this.initializeLayers();
        this.currentLayerId = 'layer-0';
        this.layerCounter = 1;

        // Интервал для конвейеров
        this.conveyorInterval = null;
        this.conveyorSimulationRunning = false;

        // Статистика
        this.statistics = {
            cabinetsProduced: 0,
            robots: {}
        };

        // Временные данные
        this.currentRobotForEdit = null;
        this.currentPostForEdit = null;
        this.currentConveyorForEdit = null;
        this.currentLineForEdit = null;
        this.pendingConnection = null;

        this.init();
    }

    // ========== ИНИЦИАЛИЗАЦИЯ ==========

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
                    pathLines: [],
                    mergedRobots: [],
                    mergedWarehouses: []
                },
                simulation: {
                    running: false,
                    paused: false,
                    postsToVisit: [],
                    visitedPosts: 0,
                    totalPosts: 0,
                    currentPath: [],
                    currentTargetIndex: 0,
                    currentAnimation: null
                }
            }
        };
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

    // ========== СВОЙСТВА ДОСТУПА ==========

    get currentLayer() {
        return this.layers[this.currentLayerId];
    }

    get currentElements() {
        return this.currentLayer.elements;
    }

    get currentSimulation() {
        return this.currentLayer.simulation;
    }

    // ========== УПРАВЛЕНИЕ СЛОЯМИ ==========

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
        const elementsToRemove = [];

        // Собираем все элементы для удаления
        if (elements.robot) elementsToRemove.push(elements.robot);
        if (elements.warehouse) elementsToRemove.push(elements.warehouse);
        
        elements.conveyors.forEach(conv => elementsToRemove.push(conv.element));
        elements.posts.forEach(post => {
            elementsToRemove.push(post.element);
            if (post.infoElement) elementsToRemove.push(post.infoElement);
        });
        elements.pathNodes.forEach(node => elementsToRemove.push(node.element));
        elements.pathLines.forEach(line => {
            elementsToRemove.push(line.element);
            if (line.labelElement) elementsToRemove.push(line.labelElement);
        });

        if (elements.mergedRobots) {
            elements.mergedRobots.forEach(robotData => {
                elementsToRemove.push(robotData.element, robotData.label);
                if (robotData.infoElement) elementsToRemove.push(robotData.infoElement);
            });
        }

        if (elements.mergedWarehouses) {
            elements.mergedWarehouses.forEach(warehouseData => {
                elementsToRemove.push(warehouseData.element);
            });
        }

        // Удаляем все элементы
        elementsToRemove.forEach(element => {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
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
        const elementsToAdd = [];

        // Собираем все элементы для добавления
        if (elements.robot) elementsToAdd.push(elements.robot);
        if (elements.warehouse) elementsToAdd.push(elements.warehouse);
        
        elements.conveyors.forEach(conv => elementsToAdd.push(conv.element));
        elements.posts.forEach(post => {
            elementsToAdd.push(post.element);
            if (post.infoElement) elementsToAdd.push(post.infoElement);
        });
        elements.pathNodes.forEach(node => elementsToAdd.push(node.element));
        elements.pathLines.forEach(line => {
            elementsToAdd.push(line.element);
            if (line.labelElement) elementsToAdd.push(line.labelElement);
        });

        if (elements.mergedRobots) {
            elements.mergedRobots.forEach(robotData => {
                elementsToAdd.push(robotData.element, robotData.label);
                if (robotData.infoElement) elementsToAdd.push(robotData.infoElement);
            });
        }

        if (elements.mergedWarehouses) {
            elements.mergedWarehouses.forEach(warehouseData => {
                elementsToAdd.push(warehouseData.element);
            });
        }

        // Добавляем все элементы
        elementsToAdd.forEach(element => {
            if (element) this.workshop.appendChild(element);
        });
    }

    // ========== СИСТЕМА ИНСТРУМЕНТОВ ==========

    selectTool(tool) {
        console.log('Tool selected:', tool);
        this.selectedTool = tool;
        
        document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
        const activeTool = document.querySelector(`.tool[data-tool="${tool}"]`);
        if (activeTool) activeTool.classList.add('active');

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

    setDeleteMode(mode) {
        this.deleteMode = mode;
        const deleteBtn = document.getElementById('delete-btn');

        if (this.deleteMode) {
            deleteBtn.style.backgroundColor = '#ff0000';
            deleteBtn.textContent = 'Режим удаления (кликните на объект)';
            this.workshop.style.cursor = 'pointer';
            this.workshop.classList.add('delete-mode');

            document.querySelectorAll('.path-node, .path-line, .line-length').forEach(el => {
                el.style.opacity = '0.8';
            });
        } else {
            deleteBtn.style.backgroundColor = '#dc3545';
            deleteBtn.textContent = 'Удалить объекты';
            this.workshop.style.cursor = 'default';
            this.workshop.classList.remove('delete-mode');

            document.querySelectorAll('.path-node, .path-line, .line-length').forEach(el => {
                el.style.opacity = '1';
            });
        }
    }

    toggleDeleteMode() {
        this.deleteMode = !this.deleteMode;
        this.setDeleteMode(this.deleteMode);

        if (this.deleteMode) {
            this.selectedTool = null;
            document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
        }
    }

    // ========== ОБРАБОТКА СОБЫТИЙ ==========

    setupEventListeners() {
        this.setupControlButtons();
        this.setupLayerControls();
        this.setupModalHandlers();
    }

    setupControlButtons() {
        const controlButtons = {
            'save-btn': () => this.saveConfiguration(),
            'load-btn': () => this.loadConfiguration(),
            'start-btn': () => this.startSimulation(),
            'stop-btn': () => this.stopSimulation(),
            'resume-btn': () => this.resumeSimulation(),
            'reset-btn': () => this.resetSimulation(),
            'delete-btn': () => this.toggleDeleteMode(),
            'auto-route-btn': () => this.generateAutoRoute(),
            'validate-routes-btn': () => this.validateRoutes()
        };

        Object.keys(controlButtons).forEach(btnId => {
            const button = document.getElementById(btnId);
            if (button) {
                button.addEventListener('click', controlButtons[btnId]);
            }
        });
    }

    setupLayerControls() {
        const addLayerBtn = document.getElementById('add-layer-btn');
        const removeLayerBtn = document.getElementById('remove-layer-btn');
        const layerSelect = document.getElementById('layer-select');
        const mergeLayersBtn = document.getElementById('merge-layers-btn');

        if (addLayerBtn) addLayerBtn.addEventListener('click', () => this.addLayer());
        if (removeLayerBtn) removeLayerBtn.addEventListener('click', () => this.removeLayer());
        if (mergeLayersBtn) mergeLayersBtn.addEventListener('click', () => this.mergeLayers());
        if (layerSelect) layerSelect.addEventListener('change', (e) => this.switchLayer(e.target.value));
    }

    setupModalHandlers() {
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

    setupModalEnterHandlers() {
        const modals = [
            { id: 'post-modal', saveBtn: 'save-post' },
            { id: 'connection-modal', saveBtn: 'save-connection', singleInput: true },
            { id: 'length-modal', saveBtn: 'save-length', singleInput: true },
            { id: 'robot-modal', saveBtn: 'save-robot' },
            { id: 'conveyor-modal', saveBtn: 'save-conveyor' }
        ];

        modals.forEach(({ id, saveBtn, singleInput }) => {
            const modal = document.getElementById(id);
            if (!modal) return;

            const saveButton = document.getElementById(saveBtn);
            const inputs = singleInput ? [modal.querySelector('input')] : modal.querySelectorAll('input');

            inputs.forEach(input => {
                if (input) {
                    input.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter' && saveButton) {
                            saveButton.click();
                        }
                    });
                }
            });
        });
    }

    handleWorkshopClick(e) {
        console.log('Workshop clicked - target:', e.target.className, 'delete mode:', this.deleteMode);

        if (this.deleteMode) {
            this.handleDelete(e);
            return;
        }

        if (!this.selectedTool) {
            console.log('No tool selected');
            return;
        }

        const rect = this.workshop.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const snapPoint = this.findClosestSnapPoint(x, y);

        this.placeElement(this.selectedTool, snapPoint.x, snapPoint.y, e);
    }

    placeElement(toolType, x, y, event) {
        console.log('Placing element:', toolType, 'at', x, y);

        switch (toolType) {
            case 'robot':
            case 'big-robot':
                this.placeRobot(x, y, toolType);
                break;
            case 'warehouse':
                this.placeWarehouse(x, y);
                break;
            case 'conveyor':
                this.placeConveyor(x, y);
                break;
            case 'post':
            case 'uis':
                this.placePost(x, y, toolType);
                break;
            case 'node':
                this.placePathNode(x, y);
                break;
            case 'path':
                this.handlePathToolClick(event);
                break;
        }
    }

    handlePathToolClick(e) {
        console.log('Path tool click - target:', e.target.className);
        const clickedNode = e.target.closest('.path-node');
        if (clickedNode) {
            console.log('Found path node for connection');
            this.connectToNode(clickedNode);
        }
    }

    // ========== СИСТЕМА СЕТКИ ==========

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

    // ========== РАЗМЕЩЕНИЕ ЭЛЕМЕНТОВ ==========

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
        if (this.currentElements.warehouse) {
            this.removeElementFromDOM(this.currentElements.warehouse);
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

    placeConveyor(x, y) {
        console.log('Placing conveyor at exact position:', x, y);
        
        this.currentConveyorForEdit = {
            x: x,
            y: y,
            productionTime: 5400000
        };
        this.openConveyorModal();
    }

    placePost(x, y, type = 'post') {
        console.log('Placing post of type:', type);

        const post = document.createElement('div');
        post.className = 'element post';
        post.style.left = x + 'px';
        post.style.top = y + 'px';

        const postImage = type === 'uis' ? this.config.images.uis : this.config.images.post;
        post.innerHTML = `<img src="${postImage}" alt="${type === 'uis' ? 'УИС' : 'Пост'}" style="width:100%;height:100%;">`;
        post.dataset.postType = type;

        this.workshop.appendChild(post);

        const info = document.createElement('div');
        info.className = 'post-info';
        info.style.left = (x + 20) + 'px';
        info.style.top = (y - 15) + 'px';
        info.textContent = type === 'uis' ? 'УИС?' : '?';

        this.workshop.appendChild(info);

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

    getNextPostNumber(type = 'post') {
        const posts = this.currentElements.posts.filter(post => post.type === type);
        if (posts.length === 0) return 1;

        const maxNumber = Math.max(...posts.map(post => post.number));
        return maxNumber + 1;
    }

    // ========== СИСТЕМА ПУТЕЙ ==========

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
            console.log('Path node clicked', {
                deleteMode: this.deleteMode,
                selectedTool: this.selectedTool
            });

            if (this.deleteMode) {
                this.removePathNode(node);
            } else if (this.selectedTool === 'path') {
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
        console.log('Path node created successfully at:', x, y);
        return nodeData;
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

    areNodesConnected(node1, node2) {
        return node1.connections.some(conn => conn.node === node2) ||
               node2.connections.some(conn => conn.node === node1);
    }

    createConnection(node1, node2, customLength = null) {
        const line = document.createElement('div');
        line.className = 'path-line';

        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;
        const visualLength = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        line.style.width = visualLength + 'px';
        line.style.left = node1.x + 'px';
        line.style.top = node1.y + 'px';
        line.style.transform = `rotate(${angle}deg)`;
        line.style.transformOrigin = '0 0';

        line.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.deleteMode) {
                this.removePathLine(line);
            }
        });

        this.workshop.appendChild(line);

        const connectionLength = customLength || (visualLength / this.config.workshop.scale);

        node1.connections.push({
            node: node2,
            lineElement: line,
            length: connectionLength
        });

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

    updateLineLengthDisplay(lineData) {
        if (lineData.labelElement) {
            this.removeElementFromDOM(lineData.labelElement);
        }

        const label = document.createElement('div');
        label.className = 'line-length';
        label.textContent = lineData.length.toFixed(1) + 'м';
        label.style.left = (lineData.startNode.x + (lineData.endNode.x - lineData.startNode.x) / 2) + 'px';
        label.style.top = (lineData.startNode.y + (lineData.endNode.y - lineData.startNode.y) / 2) + 'px';
        label.style.cursor = 'pointer';

        label.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.deleteMode) {
                this.removePathLine(lineData.element);
            } else {
                this.editLineLengthFromLabel(label);
            }
        });

        this.workshop.appendChild(label);
        lineData.labelElement = label;
    }

    // ========== УДАЛЕНИЕ ЭЛЕМЕНТОВ ==========

    handleDelete(e) {
        e.stopPropagation();
        const element = e.target.closest('.element, .path-node, .path-line, .post-info, .line-length, .robot-label, .warehouse, .robot-info, .conveyor, .conveyor-segment');
        if (!element) return;

        console.log('Deleting element:', element.className);

        if (element.classList.contains('conveyor') || element.classList.contains('conveyor-segment')) {
            this.removeConveyorSystem(element);
            return;
        }

        if (element.classList.contains('path-node')) {
            this.removePathNode(element);
            return;
        } else if (element.classList.contains('path-line')) {
            this.removePathLine(element);
            return;
        }

        this.handleElementDeletion(element);
    }

    handleElementDeletion(element) {
        if (element.classList.contains('element')) {
            this.handleStandardElementDeletion(element);
        } else if (element.classList.contains('post-info')) {
            this.handlePostInfoDeletion(element);
        } else if (element.classList.contains('line-length')) {
            this.editLineLengthFromLabel(element);
        } else if (element.classList.contains('robot-label')) {
            this.handleRobotLabelDeletion(element);
        } else if (element.classList.contains('robot-info')) {
            this.handleRobotInfoDeletion(element);
        } else if (element.classList.contains('warehouse')) {
            this.handleWarehouseDeletion(element);
        }
    }

    handleStandardElementDeletion(element) {
        if (element.classList.contains('robot')) {
            this.removeRobot();
        } else if (element.classList.contains('warehouse')) {
            this.removeWarehouse();
        } else if (element.classList.contains('conveyor')) {
            this.removeConveyor(element);
        } else if (element.classList.contains('post')) {
            this.removePost(element);
        }
    }

    removeRobot() {
        if (this.currentElements.robot) {
            this.removeElementFromDOM(this.currentElements.robot);
            if (this.currentElements.robot.infoElement) {
                this.removeElementFromDOM(this.currentElements.robot.infoElement);
            }
            this.currentElements.robot = null;
        }
    }

    removeWarehouse() {
        if (this.currentElements.warehouse) {
            this.removeElementFromDOM(this.currentElements.warehouse);
            this.currentElements.warehouse = null;
        }
    }

    removeConveyor(element) {
        this.removeElementFromDOM(element);
        this.currentElements.conveyors = this.currentElements.conveyors.filter(conv => conv.element !== element);
    }

    removePost(element) {
        const post = this.currentElements.posts.find(p => p.element === element);
        if (post) {
            this.removeElementFromDOM(post.element);
            if (post.infoElement) this.removeElementFromDOM(post.infoElement);
            this.currentElements.posts = this.currentElements.posts.filter(p => p !== post);
        }
    }

    handlePostInfoDeletion(element) {
        const post = this.currentElements.posts.find(p => p.infoElement === element);
        if (post) {
            this.removeElementFromDOM(post.element);
            this.removeElementFromDOM(post.infoElement);
            this.currentElements.posts = this.currentElements.posts.filter(p => p !== post);
        }
    }

    handleRobotLabelDeletion(element) {
        const robotData = this.currentElements.mergedRobots?.find(r => r.label === element);
        if (robotData) {
            this.removeMergedRobot(robotData);
        }
    }

    handleRobotInfoDeletion(element) {
        let robotData = this.currentElements.mergedRobots?.find(r => r.infoElement === element);
        if (robotData) {
            this.removeMergedRobot(robotData);
        } else if (this.currentElements.robot?.infoElement === element) {
            this.removeRobot();
        }
    }

    handleWarehouseDeletion(element) {
        const warehouseData = this.currentElements.mergedWarehouses?.find(w => w.element === element);
        if (warehouseData) {
            this.removeMergedWarehouse(warehouseData);
        } else if (this.currentElements.warehouse === element) {
            this.removeWarehouse();
        }
    }

    removeMergedRobot(robotData) {
        this.removeElementFromDOM(robotData.element);
        this.removeElementFromDOM(robotData.label);
        if (robotData.infoElement) this.removeElementFromDOM(robotData.infoElement);
        
        this.currentElements.mergedRobots = this.currentElements.mergedRobots.filter(r => r !== robotData);
    }

    removeMergedWarehouse(warehouseData) {
        this.removeElementFromDOM(warehouseData.element);
        this.currentElements.mergedWarehouses = this.currentElements.mergedWarehouses.filter(w => w !== warehouseData);
    }

    removeElementFromDOM(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    removeConveyorSystem(conveyorElement) {
        const systemId = conveyorElement.dataset.system;
        console.log('Removing conveyor system:', systemId);

        if (!systemId) {
            this.removeElementFromDOM(conveyorElement);
            this.currentElements.conveyors = this.currentElements.conveyors.filter(
                conv => conv.element !== conveyorElement
            );
            return;
        }

        const system = this.conveyorSystems.find(sys => sys.id === systemId);
        if (system) {
            system.segments.forEach(segment => {
                this.removeElementFromDOM(segment.element);
            });

            if (system.activeCabinet?.element) {
                this.removeElementFromDOM(system.activeCabinet.element);
            }

            this.conveyorSystems = this.conveyorSystems.filter(sys => sys.id !== systemId);
            this.currentElements.conveyors = this.currentElements.conveyors.filter(
                conv => conv.systemId !== systemId
            );
        } else {
            this.removeElementFromDOM(conveyorElement);
            this.currentElements.conveyors = this.currentElements.conveyors.filter(
                conv => conv.element !== conveyorElement
            );
        }
    }

    removePathNode(nodeElement) {
        console.log('=== START removePathNode ===');

        if (!nodeElement?.parentNode) {
            this.currentElements.pathNodes = this.currentElements.pathNodes.filter(
                n => n.element !== nodeElement
            );
            return;
        }

        const nodeIndex = this.currentElements.pathNodes.findIndex(n => n.element === nodeElement);
        if (nodeIndex === -1) {
            this.removeElementFromDOM(nodeElement);
            return;
        }

        const node = this.currentElements.pathNodes[nodeIndex];
        console.log('Removing node with', node.connections.length, 'connections');

        const connectionsToRemove = [...node.connections];
        connectionsToRemove.forEach((connection) => {
            if (connection.node?.connections) {
                connection.node.connections = connection.node.connections.filter(
                    conn => conn.lineElement !== connection.lineElement
                );
            }

            if (connection.lineElement) {
                const lineIndex = this.currentElements.pathLines.findIndex(
                    line => line.element === connection.lineElement
                );

                if (lineIndex !== -1) {
                    const lineData = this.currentElements.pathLines[lineIndex];
                    this.removeElementFromDOM(lineData.labelElement);
                    this.removeElementFromDOM(connection.lineElement);
                    this.currentElements.pathLines.splice(lineIndex, 1);
                }
            }
        });

        this.removeElementFromDOM(nodeElement);
        this.currentElements.pathNodes.splice(nodeIndex, 1);

        this.currentElements.posts.forEach(post => {
            if (post.node === node) {
                post.node = null;
            }
        });

        console.log('Node removal completed. Remaining nodes:', this.currentElements.pathNodes.length);
    }

    removePathLine(lineElement) {
        console.log('Attempting to remove path line');

        const lineIndex = this.currentElements.pathLines.findIndex(l => l.element === lineElement);
        if (lineIndex === -1) return;

        const line = this.currentElements.pathLines[lineIndex];

        if (line.startNode) {
            line.startNode.connections = line.startNode.connections.filter(c => c.lineElement !== lineElement);
        }
        if (line.endNode) {
            line.endNode.connections = line.endNode.connections.filter(c => c.lineElement !== lineElement);
        }

        this.removeElementFromDOM(line.labelElement);
        this.removeElementFromDOM(line.element);

        this.currentElements.pathLines.splice(lineIndex, 1);
        console.log('Path line removal completed');
    }

    // ========== МОДАЛЬНЫЕ ОКНА ==========

    openPostModal(defaultNumber = 1, type = 'post') {
        const modal = document.getElementById('post-modal');
        if (!modal) return;

        const title = modal.querySelector('h3');
        const conveyorGroup = modal.querySelector('.modal-input:first-child');
        const numberLabel = modal.querySelector('.modal-input:last-child label');
        const numberInput = document.getElementById('post-number');

        if (title) title.textContent = type === 'uis' ? 'Настройка УИС' : 'Настройка поста';
        if (conveyorGroup) conveyorGroup.style.display = type === 'uis' ? 'none' : 'block';
        if (numberLabel) numberLabel.textContent = type === 'uis' ? 'Номер УИС:' : 'Номер поста:';
        if (numberInput) numberInput.value = defaultNumber;

        modal.style.display = 'block';
    }

    closePostModal() {
        this.closeModal('post-modal');
        this.currentPostForEdit = null;
    }

    openRobotModal() {
        this.openModalWithValues('robot-modal', {
            'robot-speed-input': this.currentRobotForEdit.speed,
            'robot-post-time': this.currentRobotForEdit.postStopTime,
            'robot-warehouse-time': this.currentRobotForEdit.warehouseStopTime
        });
    }

    closeRobotModal() {
        this.closeModal('robot-modal');
        this.currentRobotForEdit = null;
    }

    openConveyorModal() {
        this.openModalWithValues('conveyor-modal', {
            'conveyor-production-time': this.currentConveyorForEdit.productionTime / 60000
        });
    }

    closeConveyorModal() {
        this.closeModal('conveyor-modal');
        this.currentConveyorForEdit = null;
    }

    openConnectionModal() {
        const modal = document.getElementById('connection-modal');
        const input = document.getElementById('connection-length');

        if (modal && input && this.pendingConnection) {
            const distance = Math.sqrt(
                Math.pow(this.pendingConnection.node2.x - this.pendingConnection.node1.x, 2) +
                Math.pow(this.pendingConnection.node2.y - this.pendingConnection.node1.y, 2)
            ) / this.config.workshop.scale;

            input.value = distance.toFixed(1);
            modal.style.display = 'block';
        }
    }

    openModalWithValues(modalId, values) {
        const modal = document.getElementById(modalId);
        if (modal) {
            Object.keys(values).forEach(inputId => {
                const input = document.getElementById(inputId);
                if (input) input.value = values[inputId];
            });
            modal.style.display = 'block';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // ========== СОХРАНЕНИЕ КОНФИГУРАЦИЙ ==========

    savePostConfig() {
        if (!this.currentPostForEdit) return;

        const conveyorInput = document.getElementById('conveyor-number');
        const numberInput = document.getElementById('post-number');
        if (!numberInput) return;

        const conveyor = this.currentPostForEdit.type === 'uis' ? 0 : (parseInt(conveyorInput?.value) || 1);
        const number = parseInt(numberInput.value) || 1;

        this.currentPostForEdit.conveyor = conveyor;
        this.currentPostForEdit.number = number;

        if (this.currentPostForEdit.type === 'uis') {
            this.currentPostForEdit.infoElement.textContent = `УИС${number}`;
        } else {
            this.currentPostForEdit.infoElement.textContent = `${conveyor}-${number}`;
        }

        this.closePostModal();
    }

    saveRobotConfig() {
        if (!this.currentRobotForEdit) {
            console.error('No robot configuration to save!');
            this.closeRobotModal();
            return;
        }

        const speedInput = document.getElementById('robot-speed-input');
        const postTimeInput = document.getElementById('robot-post-time');
        const warehouseTimeInput = document.getElementById('robot-warehouse-time');

        if (!speedInput || !postTimeInput || !warehouseTimeInput) {
            console.error('Robot configuration inputs not found!');
            return;
        }

        const speed = parseFloat(speedInput.value) || 0.6;
        const postTime = parseInt(postTimeInput.value) || 30;
        const warehouseTime = parseInt(warehouseTimeInput.value) || 300;

        this.removeExistingRobot();

        const robot = this.createRobotElement(this.currentRobotForEdit.x, this.currentRobotForEdit.y, this.currentRobotForEdit.type);
        this.workshop.appendChild(robot);
        this.currentElements.robot = robot;

        const info = this.createRobotInfoElement(this.currentRobotForEdit.x, this.currentRobotForEdit.y, speed);
        this.workshop.appendChild(info);

        this.currentElements.robot.speed = speed;
        this.currentElements.robot.postStopTime = postTime;
        this.currentElements.robot.warehouseStopTime = warehouseTime;
        this.currentElements.robot.infoElement = info;
        this.currentElements.robot.type = this.currentRobotForEdit.type;

        this.placePathNode(this.currentRobotForEdit.x, this.currentRobotForEdit.y);
        this.closeRobotModal();

        console.log('Robot created with type:', this.currentRobotForEdit.type);
    }

    removeExistingRobot() {
        if (this.currentElements.robot) {
            this.removeElementFromDOM(this.currentElements.robot);
            if (this.currentElements.robot.infoElement) {
                this.removeElementFromDOM(this.currentElements.robot.infoElement);
            }
        }
    }

    createRobotElement(x, y, type) {
        const robot = document.createElement('div');
        robot.className = 'element robot';
        robot.style.left = x + 'px';
        robot.style.top = y + 'px';

        const robotImage = type === 'bigRobot' ? this.config.images.bigRobot : this.config.images.robot;
        robot.innerHTML = `<img src="${robotImage}" alt="Робот" style="width:100%;height:100%;">`;
        robot.dataset.robotType = type;

        return robot;
    }

    createRobotInfoElement(x, y, speed) {
        const info = document.createElement('div');
        info.className = 'robot-info';
        info.style.left = (x + 20) + 'px';
        info.style.top = (y - 15) + 'px';
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
        return info;
    }

    saveConveyorConfig() {
        if (!this.currentConveyorForEdit) {
            console.error('No conveyor configuration to save!');
            this.closeConveyorModal();
            return;
        }

        const productionTimeInput = document.getElementById('conveyor-production-time');
        if (!productionTimeInput) {
            console.error('Production time input not found!');
            return;
        }

        const productionTimeMinutes = parseInt(productionTimeInput.value) || 90;
        const productionTimeMs = productionTimeMinutes * 60000;

        const systemId = 'conveyor-system-' + Date.now();
        this.createConveyorSystem(
            this.currentConveyorForEdit.x,
            this.currentConveyorForEdit.y,
            systemId,
            productionTimeMs
        );

        this.closeConveyorModal();
        console.log(`Conveyor system created at exact position (${this.currentConveyorForEdit.x}, ${this.currentConveyorForEdit.y})`);
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
        this.closeModal('connection-modal');
        this.pendingConnection = null;
        this.resetNodeSelection();
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
        this.closeModal('length-modal');
        this.currentLineForEdit = null;
    }

    // ========== СИСТЕМА КОНВЕЙЕРОВ ==========

    createConveyorSystem(x, y, systemId, productionTime = 5400000) {
        console.log(`Creating conveyor system ${systemId} at exact position (${x}, ${y})`);
        
        const gridSize = this.config.workshop.scale;
        const conveyorLength = 12;

        const conveyorSystem = {
            id: systemId,
            segments: [],
            activeCabinet: null,
            lastCabinetTime: 0,
            cabinetInterval: productionTime / 6,
            productionTime: productionTime
        };

        for (let i = 0; i < conveyorLength; i++) {
            const conveyor = document.createElement('div');
            conveyor.className = 'element conveyor conveyor-segment';
            conveyor.style.left = (x + i * gridSize) + 'px';
            conveyor.style.top = y + 'px';
            conveyor.style.width = gridSize + 'px';
            conveyor.style.height = gridSize + 'px';
            conveyor.dataset.system = systemId;
            conveyor.dataset.segment = i + 1;

            conveyor.style.backgroundColor = 'white';
            conveyor.style.border = '1px solid #333';
            conveyor.style.display = 'flex';
            conveyor.style.alignItems = 'center';
            conveyor.style.justifyContent = 'center';
            conveyor.style.fontSize = '8px';
            conveyor.style.color = '#333';
            conveyor.innerHTML = `C${i + 1}`;

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
        console.log(`Created conveyor system ${systemId} at exact position (${x}, ${y}) with ${conveyorLength} segments`);
    }

    startConveyorSimulation() {
        if (this.conveyorInterval) {
            clearInterval(this.conveyorInterval);
        }
        
        this.conveyorSimulationRunning = true;
        this.lastUpdateTime = Date.now();
        
        this.conveyorInterval = setInterval(() => {
            if (!this.conveyorSimulationRunning) return;
            
            const currentTime = Date.now();
            const deltaTime = currentTime - this.lastUpdateTime;
            this.lastUpdateTime = currentTime;

            this.conveyorSystems.forEach(system => {
                this.processConveyorSystem(system, deltaTime);
            });

            this.updateCabinetAnimations();
        }, 100);
    }

    updateCabinetAnimations() {
        this.conveyorSystems.forEach(system => {
            if (system.activeCabinet) {
                system.activeCabinet.element.style.transition = `left 0.1s linear, top 0.1s linear`;
            }
        });
    }

    processConveyorSystem(system, deltaTime) {
        if (!this.currentSimulation.running || this.currentSimulation.paused) return;

        if (!system.activeCabinet && Date.now() - system.lastCabinetTime >= system.cabinetInterval) {
            this.createCabinetOnSystem(system);
        }

        if (system.activeCabinet) {
            this.updateCabinetPosition(system, deltaTime);
        }
    }

    updateCabinetPosition(system, deltaTime) {
        const cabinet = system.activeCabinet;
        const totalSegments = system.segments.length;
        const timePerSegment = system.productionTime / totalSegments;

        cabinet.progress += deltaTime / timePerSegment;

        if (cabinet.progress >= 1) {
            cabinet.currentSegment++;
            cabinet.progress = 0;

            if (cabinet.currentSegment > 1) {
                system.segments[cabinet.currentSegment - 2].hasCabinet = false;
            }

            if (cabinet.currentSegment > totalSegments) {
                this.completeCabinet(system);
                return;
            }

            system.segments[cabinet.currentSegment - 1].hasCabinet = true;
        }

        cabinet.totalProgress = (cabinet.currentSegment - 1 + cabinet.progress) / totalSegments;
        cabinet.weight = 1 + cabinet.totalProgress;
        this.updateCabinetVisualPosition(system, cabinet);
    }

    updateCabinetVisualPosition(system, cabinet) {
        const currentSegment = system.segments[cabinet.currentSegment - 1];
        const segmentWidth = this.config.workshop.scale;

        const segmentProgress = cabinet.progress;
        const cabinetX = currentSegment.x + segmentProgress * segmentWidth;
        const cabinetY = currentSegment.y;

        const centerX = cabinetX + segmentWidth / 4;
        const centerY = cabinetY + segmentWidth / 4;

        cabinet.element.style.left = centerX + 'px';
        cabinet.element.style.top = centerY + 'px';

        const progressColor = this.getCabinetColor(cabinet.totalProgress);
        cabinet.element.style.backgroundColor = progressColor;
    }

    getCabinetColor(progress) {
        const startColor = { r: 139, g: 69, b: 19 };
        const endColor = { r: 101, g: 67, b: 33 };

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
            progress: 0,
            totalProgress: 0,
            weight: 1
        };

        system.lastCabinetTime = Date.now();
        firstSegment.hasCabinet = true;

        console.log(`Cabinet created on conveyor system ${system.id}`);
    }

    completeCabinet(system) {
        if (system.activeCabinet?.element?.parentNode) {
            this.workshop.removeChild(system.activeCabinet.element);
        }

        const lastSegment = system.segments[system.segments.length - 1];
        lastSegment.hasCabinet = false;

        this.statistics.cabinetsProduced++;
        this.updateStatisticsDisplay();

        console.log(`Cabinet completed on system ${system.id}! Total: ${this.statistics.cabinetsProduced}`);
        system.activeCabinet = null;
    }

    stopConveyorSimulation() {
        this.conveyorSimulationRunning = false;
        if (this.conveyorInterval) {
            clearInterval(this.conveyorInterval);
            this.conveyorInterval = null;
        }
    }

    // ========== СИМУЛЯЦИЯ ДВИЖЕНИЯ ==========

    startSimulation() {
        console.log('=== START SIMULATION ===');
        
        this.validateRoutes();

        if (this.currentSimulation.postsToVisit.length === 0) {
            console.log('Generating routes before starting simulation...');
            this.generateAutoRoute();
        }

        this.startConveyorSimulation();

        if (this.currentLayerId.startsWith('merged-')) {
            this.startMergedSimulation();
        } else {
            this.startAllLayersSimulation();
        }
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

            const toPostPath = this.findShortestPathInLayer(warehouseNode, postNode, layer);
            if (toPostPath.length > 0) {
                await this.followPathInLayer(toPostPath, layer, elements.robot);
            }

            if (simulation.running && !simulation.paused) {
                currentPost.visited = true;
                simulation.visitedPosts++;
                this.updatePostsVisited();

                await this.delay((elements.robot.postStopTime || 30) * 1000);
            }

            if (simulation.running && !simulation.paused) {
                const toWarehousePath = this.findShortestPathInLayer(postNode, warehouseNode, layer);
                if (toWarehousePath.length > 0) {
                    await this.followPathInLayer(toWarehousePath, layer, elements.robot);
                }

                await this.delay((elements.robot.warehouseStopTime || 300) * 1000);
            }

            currentPostIndex++;
        }

        simulation.running = false;
        this.updateStatus(`Слой ${layer.name}: Все посты посещены!`);
    }

    findClosestNodeInLayer(element, layer) {
        if (!element) return null;

        let elementX, elementY;

        if (element.style && element.style.left && element.style.top) {
            elementX = parseFloat(element.style.left);
            elementY = parseFloat(element.style.top);
        } else if (element.x !== undefined && element.y !== undefined) {
            elementX = element.x;
            elementY = element.y;
        } else {
            return null;
        }

        let closestNode = null;
        let minDistance = Infinity;
        const searchRadius = this.config.workshop.scale * 2;

        layer.elements.pathNodes.forEach(node => {
            const distance = Math.sqrt(
                Math.pow(node.x - elementX, 2) + Math.pow(node.y - elementY, 2)
            );

            if (distance < minDistance && distance < searchRadius) {
                minDistance = distance;
                closestNode = node;
            }
        });

        return closestNode;
    }

    async followPathInLayer(path, layer, robotElement) {
        const speed = robotElement.speed || 0.6;

        for (let i = 0; i < path.length - 1; i++) {
            if (!layer.simulation.running || layer.simulation.paused) break;

            const currentNode = path[i];
            const nextNode = path[i + 1];

            const connection = currentNode.connections.find(c => c.node === nextNode);
            if (!connection) continue;

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

    // ========== СОВМЕЩЕННАЯ СИМУЛЯЦИЯ ==========

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
        this.linkPostsToNodesInMergedLayer(mergedLayer);
        this.correctElementPositionsInMergedLayer(mergedLayer);

        this.switchLayer(mergedLayerId);
        this.updateLayerSelect();

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
            const offsetX = layerIndex;
            const offsetY = layerIndex;

            if (sourceLayer.elements.warehouse) {
                const warehouse = sourceLayer.elements.warehouse.cloneNode(true);
                const originalX = parseFloat(sourceLayer.elements.warehouse.style.left);
                const originalY = parseFloat(sourceLayer.elements.warehouse.style.top);

                warehouse.style.left = (originalX + offsetX) + 'px';
                warehouse.style.top = (originalY + offsetY) + 'px';

                const warehouseNode = this.placePathNode(originalX + offsetX, originalY + offsetY);
                warehouseNode.layerIndex = layerIndex;

                targetLayer.elements.mergedWarehouses.push({
                    element: warehouse,
                    x: originalX + offsetX,
                    y: originalY + offsetY,
                    layerIndex: layerIndex,
                    node: warehouseNode
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

                nodeElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.selectedTool === 'path') {
                        this.connectToNode(nodeElement);
                    }
                });
            });

            sourceLayer.elements.pathLines.forEach(originalLine => {
                const lineElement = originalLine.element.cloneNode(true);
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

                    this.createConnectionInMergedLayer(startNode, endNode, originalLine.length, lineElement);
                    this.createLineLabel(lineData);
                }
            });

            if (sourceLayer.elements.robot) {
                this.createMergedRobot(sourceLayer, layerIndex, targetLayer);
            }
        });
    }

    createMergedRobot(sourceLayer, layerIndex, targetLayer) {
        const colors = ['#007bff', '#dc3545', '#28a745', '#ffc107', '#17a2b8', '#6f42c1'];

        const originalRobot = sourceLayer.elements.robot;
        let robotX = parseFloat(originalRobot.style.left);
        let robotY = parseFloat(originalRobot.style.top);

        const offsetX = layerIndex;
        const offsetY = layerIndex;
        robotX += offsetX;
        robotY += offsetY;

        console.log('Creating merged robot at position:', robotX, robotY, 'for layer:', layerIndex);

        const robotNode = this.placePathNode(robotX, robotY);
        robotNode.layerIndex = layerIndex;

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

        const robotImage = originalRobot.type === 'bigRobot' ? this.config.images.bigRobot : this.config.images.robot;
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
            type: originalRobot.type || 'robot',
            simulationData: null,
            node: robotNode
        };

        targetLayer.elements.mergedRobots.push(robotData);

        this.workshop.appendChild(robot);
        this.workshop.appendChild(label);
        this.workshop.appendChild(info);

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

    createConnectionInMergedLayer(node1, node2, length, lineElement) {
        const connectionData1 = { node: node2, lineElement: lineElement, length: length };
        const connectionData2 = { node: node1, lineElement: lineElement, length: length };

        node1.connections.push(connectionData1);
        node2.connections.push(connectionData2);
    }

    linkPostsToNodesInMergedLayer(mergedLayer) {
        console.log('Linking posts to nodes in merged layer...');

        mergedLayer.elements.posts.forEach(post => {
            if (!post.node) {
                const closestNode = this.findMergedNode(post.element, post.layerIndex, mergedLayer);
                if (closestNode) {
                    post.node = closestNode;
                    console.log(`Linked post ${post.conveyor}-${post.number} to node at (${closestNode.x}, ${closestNode.y})`);
                }
            }
        });

        if (mergedLayer.elements.mergedRobots) {
            mergedLayer.elements.mergedRobots.forEach(robot => {
                const robotNode = this.findMergedNode(robot.element, robot.layerIndex, mergedLayer);
                if (robotNode) {
                    console.log(`Robot ${robot.layerIndex} is at node (${robotNode.x}, ${robotNode.y})`);
                }
            });
        }

        if (mergedLayer.elements.mergedWarehouses) {
            mergedLayer.elements.mergedWarehouses.forEach(warehouse => {
                const warehouseNode = this.findMergedNode(warehouse.element, warehouse.layerIndex, mergedLayer);
                if (warehouseNode) {
                    console.log(`Warehouse ${warehouse.layerIndex} is at node (${warehouseNode.x}, ${warehouseNode.y})`);
                }
            });
        }
    }

    findMergedNode(originalElement, layerIndex, mergedLayer) {
        if (!originalElement) return null;

        let elementX, elementY;
        if (originalElement.style && originalElement.style.left && originalElement.style.top) {
            elementX = parseFloat(originalElement.style.left);
            elementY = parseFloat(originalElement.style.top);
        } else if (originalElement.x !== undefined && originalElement.y !== undefined) {
            elementX = originalElement.x;
            elementY = originalElement.y;
        } else if (originalElement.getBoundingClientRect) {
            const rect = originalElement.getBoundingClientRect();
            const workshopRect = this.workshop.getBoundingClientRect();
            elementX = rect.left - workshopRect.left + rect.width / 2;
            elementY = rect.top - workshopRect.top + rect.height / 2;
        } else {
            return null;
        }

        let closestNode = null;
        let minDistance = Infinity;
        const searchRadius = 50;

        mergedLayer.elements.pathNodes.forEach(node => {
            if (node.layerIndex === layerIndex || node.layerIndex === undefined || layerIndex === undefined) {
                const distance = Math.sqrt(Math.pow(node.x - elementX, 2) + Math.pow(node.y - elementY, 2));
                if (distance < minDistance && distance < searchRadius) {
                    minDistance = distance;
                    closestNode = node;
                }
            }
        });

        if (!closestNode) {
            mergedLayer.elements.pathNodes.forEach(node => {
                const distance = Math.sqrt(Math.pow(node.x - elementX, 2) + Math.pow(node.y - elementY, 2));
                if (distance < minDistance && distance < searchRadius) {
                    minDistance = distance;
                    closestNode = node;
                }
            });
        }

        return closestNode;
    }

    correctElementPositionsInMergedLayer(mergedLayer) {
        console.log('Correcting element positions in merged layer...');

        if (mergedLayer.elements.mergedRobots) {
            mergedLayer.elements.mergedRobots.forEach(robot => {
                const expectedNode = this.findMergedNode(robot.element, robot.layerIndex, mergedLayer);
                if (expectedNode && (parseFloat(robot.element.style.left) !== expectedNode.x || parseFloat(robot.element.style.top) !== expectedNode.y)) {
                    console.log(`Correcting robot ${robot.layerIndex} position to (${expectedNode.x}, ${expectedNode.y})`);
                    robot.element.style.left = expectedNode.x + 'px';
                    robot.element.style.top = expectedNode.y + 'px';
                    this.updateRobotLabelPosition(robot.element, robot.label);
                    robot.infoElement.style.left = (expectedNode.x + 20) + 'px';
                    robot.infoElement.style.top = (expectedNode.y - 15) + 'px';
                }
            });
        }

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

    startMergedSimulation() {
        if (!this.currentElements.mergedRobots || this.currentElements.mergedRobots.length === 0) {
            alert('Нет роботов для симуляции!');
            return;
        }

        const postsWithoutNodes = this.currentElements.posts.filter(post => !post.node);
        if (postsWithoutNodes.length > 0) {
            console.log('Found posts without nodes, attempting to fix...', postsWithoutNodes.length);
            this.restoreConnectionsForMergedLayer();
        }

        this.currentSimulation.running = true;
        this.currentSimulation.paused = false;

        let activeRobots = 0;

        console.log('Starting merged simulation for', this.currentElements.mergedRobots.length, 'robots');

        this.currentElements.mergedRobots.forEach(robotData => {
            console.log('Creating simulation data for robot:', robotData.layerIndex);
            
            const simulationData = this.createIndependentSimulationData(robotData);
            if (simulationData && simulationData.posts.length > 0) {
                robotData.simulationData = simulationData;
                robotData.simulationData.currentPostIndex = 0;
                robotData.simulationData.currentPath = [];
                robotData.simulationData.isMoving = false;
                activeRobots++;

                console.log('Starting simulation for robot:', robotData.layerIndex, 'with', simulationData.posts.length, 'posts');
                this.runIndependentRobotSimulation(robotData);
            } else {
                console.log('No valid simulation data for robot:', robotData.layerIndex);
            }
        });

        if (activeRobots === 0) {
            alert('Нет роботов с валидными маршрутами для симуляции! Проверьте узлы пути и связи постов.');
            this.currentSimulation.running = false;
            return;
        }

        this.updateStatus(`Совмещенная симуляция запущена для ${activeRobots} роботов`);
        console.log('Merged simulation started successfully for', activeRobots, 'robots');
    }

    createIndependentSimulationData(robotData) {
        console.log('Creating independent simulation data for robot:', robotData.layerIndex);
        
        const layerPosts = this.currentElements.posts.filter(post => {
            const matches = post.layerIndex === robotData.layerIndex;
            if (matches) {
                console.log('Found post for robot', robotData.layerIndex, ':', post.conveyor, post.number, 'at layer', post.layerIndex);
            }
            return matches;
        });
        
        console.log('Found posts for robot', robotData.layerIndex, 'in merged layer:', layerPosts.length);

        if (layerPosts.length === 0) {
            console.log('No posts found for robot:', robotData.layerIndex);
            const detectedPosts = this.findPostsByProximity(robotData);
            if (detectedPosts.length > 0) {
                console.log('Found posts by proximity for robot', robotData.layerIndex, ':', detectedPosts.length);
                return this.createSimulationDataFromPosts(robotData, detectedPosts);
            }
            return null;
        }

        return this.createSimulationDataFromPosts(robotData, layerPosts);
    }

    createSimulationDataFromPosts(robotData, posts) {
        const warehouse = this.currentElements.mergedWarehouses.find(w => w.layerIndex === robotData.layerIndex);
        if (!warehouse) {
            console.log('No warehouse found for robot:', robotData.layerIndex);
            return null;
        }

        let warehouseNode = warehouse.node;
        if (!warehouseNode) {
            warehouseNode = this.findMergedNode(warehouse.element, robotData.layerIndex, this.currentLayer);
            if (warehouseNode) {
                warehouse.node = warehouseNode;
            }
        }

        if (!warehouseNode) {
            console.log('No warehouse node found for robot:', robotData.layerIndex);
            return null;
        }

        const postsWithNodes = [];
        posts.forEach(post => {
            if (!post.node) {
                post.node = this.findMergedNode(post.element, post.layerIndex, this.currentLayer);
            }
            if (post.node) {
                postsWithNodes.push(post);
            } else {
                console.log('Could not find node for post in merged layer:', post.conveyor, post.number, 'layer:', robotData.layerIndex);
            }
        });

        if (postsWithNodes.length === 0) {
            console.log('No posts with nodes found for robot:', robotData.layerIndex);
            return null;
        }

        const sortedPosts = [...postsWithNodes].sort((a, b) => {
            if (a.conveyor !== b.conveyor) return a.conveyor - b.conveyor;
            return a.number - b.number;
        });

        console.log(`Created simulation data for robot ${robotData.layerIndex} with ${sortedPosts.length} posts`);

        return {
            robotNode: robotData.node || warehouseNode,
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

    findPostsByProximity(robotData) {
        const robotX = parseFloat(robotData.element.style.left);
        const robotY = parseFloat(robotData.element.style.top);
        const proximityThreshold = this.config.workshop.scale * 3;
        
        return this.currentElements.posts.filter(post => {
            const distance = Math.sqrt(Math.pow(post.x - robotX, 2) + Math.pow(post.y - robotY, 2));
            return distance < proximityThreshold;
        });
    }

    async runIndependentRobotSimulation(robotData) {
        if (robotData.simulationData.isMoving) {
            console.log(`Robot ${robotData.layerIndex} is already moving, skipping duplicate start`);
            return;
        }

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
            robotData.simulationData.isMoving = false;
            return;
        }

        console.log(`Starting independent simulation for robot ${robotData.layerIndex}`);

        simData.isMoving = true;

        while (this.currentSimulation.running && !this.currentSimulation.paused && simData.isMoving) {
            if (simData.currentPostIndex >= simData.posts.length) {
                console.log(`Robot ${robotData.layerIndex} completed all posts, resetting index`);
                simData.currentPostIndex = 0;
                stats.cyclesCompleted++;
            }

            const currentPost = simData.posts[simData.currentPostIndex];
            
            if (!currentPost || !currentPost.node) {
                console.log(`Invalid post at index ${simData.currentPostIndex}, skipping`);
                simData.currentPostIndex++;
                continue;
            }

            console.log(`Robot ${robotData.layerIndex} moving to post ${currentPost.conveyor}-${currentPost.number}`);

            const toPostPath = this.findShortestPath(simData.warehouseNode, currentPost.node);
            if (toPostPath.length > 0) {
                simData.currentPath = toPostPath;
                const pathDistance = this.calculatePathDistance(toPostPath);
                await this.moveRobotAlongPath(robotData, toPostPath);
                stats.distance += pathDistance;
            } else {
                console.log(`No path found from warehouse to post for robot ${robotData.layerIndex}`);
                simData.currentPostIndex++;
                continue;
            }

            if (!this.currentSimulation.running || this.currentSimulation.paused || !simData.isMoving) {
                break;
            }

            console.log(`Robot ${robotData.layerIndex} stopping at post ${currentPost.conveyor}-${currentPost.number}`);
            await this.delay(simData.postStopTime * 1000);

            if (!this.currentSimulation.running || this.currentSimulation.paused || !simData.isMoving) {
                break;
            }

            stats.postsVisited++;
            currentPost.visited = true;

            const toWarehousePath = this.findShortestPath(currentPost.node, simData.warehouseNode);
            if (toWarehousePath.length > 0) {
                simData.currentPath = toWarehousePath;
                const returnDistance = this.calculatePathDistance(toWarehousePath);
                await this.moveRobotAlongPath(robotData, toWarehousePath);
                stats.distance += returnDistance;
            }

            if (!this.currentSimulation.running || this.currentSimulation.paused || !simData.isMoving) {
                break;
            }

            console.log(`Robot ${robotData.layerIndex} stopping at warehouse`);
            await this.delay(simData.warehouseStopTime * 1000);

            if (!this.currentSimulation.running || this.currentSimulation.paused || !simData.isMoving) {
                break;
            }

            stats.deliveries++;
            simData.currentPostIndex++;

            this.updateStatisticsDisplay();

            if (simData.currentPostIndex >= simData.posts.length) {
                stats.cyclesCompleted++;
                simData.currentPostIndex = 0;
                console.log(`Robot ${robotData.layerIndex} completed cycle ${stats.cyclesCompleted}`);
            }
        }

        simData.isMoving = false;
        console.log(`Robot ${robotData.layerIndex} simulation ended. Current post index: ${simData.currentPostIndex}`);
    }

    calculatePathDistance(path) {
        let totalDistance = 0;

        for (let i = 0; i < path.length - 1; i++) {
            const currentNode = path[i];
            const nextNode = path[i + 1];

            const connection = currentNode.connections.find(c => c.node === nextNode);
            if (connection) {
                totalDistance += connection.length;
            } else {
                const dx = nextNode.x - currentNode.x;
                const dy = nextNode.y - currentNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy) / this.config.workshop.scale;
                totalDistance += distance;
            }
        }

        return totalDistance;
    }

    async moveRobotAlongPath(robotData, path) {
        console.log(`Robot ${robotData.layerIndex} moving along path with ${path.length} nodes, speed: ${robotData.simulationData.speed}`);

        for (let i = 0; i < path.length - 1; i++) {
            if (!this.currentSimulation.running || this.currentSimulation.paused) {
                console.log(`Movement interrupted for robot ${robotData.layerIndex}`);
                break;
            }

            const currentNode = path[i];
            const nextNode = path[i + 1];

            const connection = currentNode.connections.find(c => c.node === nextNode);
            if (!connection) {
                console.log(`No connection found between nodes for robot ${robotData.layerIndex}`);
                continue;
            }

            const timeMs = (connection.length / robotData.speed) * 1000;
            console.log(`Robot ${robotData.layerIndex} moving from (${currentNode.x}, ${currentNode.y}) to (${nextNode.x}, ${nextNode.y}) in ${timeMs}ms`);

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

            this.updateRobotLabelPosition(robotData.element, robotData.label);
            robotData.infoElement.style.left = (x + 20) + 'px';
            robotData.infoElement.style.top = (y - 15) + 'px';

            setTimeout(() => {
                resolve();
            }, timeMs);
        });
    }

    findShortestPath(startNode, endNode) {
        if (startNode.layerIndex !== undefined && endNode.layerIndex !== undefined &&
            startNode.layerIndex !== endNode.layerIndex) {
            return [];
        }

        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();

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

    // ========== УПРАВЛЕНИЕ СИМУЛЯЦИЕЙ ==========

    stopSimulation() {
        console.log('=== STOP SIMULATION ===');
        
        this.currentSimulation.running = false;
        this.currentSimulation.paused = false;
        this.stopConveyorSimulation();

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
                    console.log(`Robot ${robotData.layerIndex} stopped at post index: ${robotData.simulationData.currentPostIndex}`);
                }
                if (robotData.element) {
                    const computedStyle = window.getComputedStyle(robotData.element);
                    const currentLeft = parseFloat(computedStyle.left);
                    const currentTop = parseFloat(computedStyle.top);
                    
                    robotData.element.style.transition = 'none';
                    robotData.element.style.left = currentLeft + 'px';
                    robotData.element.style.top = currentTop + 'px';
                    
                    this.updateRobotLabelPosition(robotData.element, robotData.label);
                    robotData.infoElement.style.left = (currentLeft + 20) + 'px';
                    robotData.infoElement.style.top = (currentTop - 15) + 'px';
                }
            });
        }

        if (this.currentSimulation.currentAnimation) {
            clearTimeout(this.currentSimulation.currentAnimation);
            this.currentSimulation.currentAnimation = null;
        }

        this.updateStatus('Симуляция остановлена. Для продолжения нажмите "Возобновить"');
    }

    resumeSimulation() {
        console.log('=== RESUME SIMULATION ===');
        
        if (this.currentLayerId.startsWith('merged-')) {
            if (!this.currentSimulation.running || this.currentSimulation.paused) {
                this.currentSimulation.running = true;
                this.currentSimulation.paused = false;
                
                this.startConveyorSimulation();
                this.updateStatus('Симуляция возобновлена с сохраненного места');
                this.resumeMergedRobotsSimulation();
            }
        } else {
            if (!this.currentSimulation.running || this.currentSimulation.paused) {
                this.currentSimulation.running = true;
                this.currentSimulation.paused = false;
                this.startConveyorSimulation();

                if (this.currentElements.robot) {
                    this.currentElements.robot.style.transition = '';
                }

                this.updateStatus('Симуляция возобновлена с сохраненного места');
                this.visitNextPost();
            }
        }
    }

    resumeMergedRobotsSimulation() {
        console.log('Resuming merged robots simulation from saved state');
        
        if (!this.currentElements.mergedRobots || this.currentElements.mergedRobots.length === 0) {
            console.log('No merged robots to resume');
            return;
        }

        let resumedRobots = 0;

        this.currentElements.mergedRobots.forEach(robotData => {
            if (robotData.simulationData && 
                robotData.simulationData.posts.length > 0 &&
                !robotData.simulationData.isMoving) {
                
                robotData.simulationData.speed = robotData.speed || 0.6;
                robotData.simulationData.isMoving = true;
                this.runIndependentRobotSimulation(robotData);
                resumedRobots++;
                
                console.log(`Resumed robot ${robotData.layerIndex} from post index: ${robotData.simulationData.currentPostIndex}`);
            }
        });

        if (resumedRobots > 0) {
            console.log(`Resumed simulation for ${resumedRobots} robots from saved state`);
        } else {
            console.log('No robots to resume - starting from beginning');
            this.restartMergedRobotsSimulation();
        }
    }

    restartMergedRobotsSimulation() {
        console.log('Restarting merged robots simulation');
        
        if (!this.currentElements.mergedRobots || this.currentElements.mergedRobots.length === 0) {
            console.log('No merged robots to restart');
            return;
        }

        let activeRobots = 0;

        this.currentElements.mergedRobots.forEach(robotData => {
            if (robotData.simulationData && robotData.simulationData.posts.length > 0) {
                robotData.simulationData.speed = robotData.speed || 0.6;
                robotData.simulationData.isMoving = false;
                this.runIndependentRobotSimulation(robotData);
                activeRobots++;
                console.log(`Restarted robot ${robotData.layerIndex} with speed: ${robotData.simulationData.speed}`);
            }
        });

        if (activeRobots > 0) {
            console.log(`Restarted simulation for ${activeRobots} robots`);
        } else {
            console.log('No active robots to restart');
        }
    }

    resetSimulation() {
        console.log('=== RESET SIMULATION ===');
        
        this.forceStopAllProcesses();
        
        this.currentSimulation.running = false;
        this.currentSimulation.paused = false;
        this.currentSimulation.visitedPosts = 0;
        this.currentSimulation.currentPath = [];
        this.currentSimulation.currentTargetIndex = 0;
        this.currentSimulation.postsToVisit = [];

        this.resetConveyors();
        this.currentElements.posts.forEach(post => post.visited = false);

        if (this.currentElements.robot && this.currentElements.warehouse) {
            const warehouseNode = this.findClosestNode(this.currentElements.warehouse);
            if (warehouseNode) {
                this.currentElements.robot.style.transition = 'none';
                this.currentElements.robot.style.left = warehouseNode.x + 'px';
                this.currentElements.robot.style.top = warehouseNode.y + 'px';

                this.currentSimulation.currentPath = [];
                this.currentSimulation.currentTargetIndex = 0;
                this.currentSimulation.postsToVisit = [];

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
                        robotData.simulationData.currentPath = [];
                        robotData.simulationData.isMoving = false;
                        
                        const robotId = `robot-${robotData.layerIndex}`;
                        if (this.statistics.robots[robotId]) {
                            this.statistics.robots[robotId] = {
                                deliveries: 0,
                                distance: 0,
                                postsVisited: 0,
                                cyclesCompleted: 0
                            };
                        }
                    }
                });
            }
        }

        this.statistics.cabinetsProduced = 0;
        this.updateStatisticsDisplay();
        this.currentSimulation.postsToVisit = [];
        
        this.updateStatus('Симуляция полностью сброшена. Для запуска нажмите "Старт"');
        this.updatePostsVisited();
    }

    forceStopAllProcesses() {
        console.log('Force stopping all processes');
        
        this.stopConveyorSimulation();
        this.currentSimulation.running = false;
        this.currentSimulation.paused = false;
        this.currentSimulation.currentPath = [];
        this.currentSimulation.currentTargetIndex = 0;
        
        if (this.currentSimulation.currentAnimation) {
            clearTimeout(this.currentSimulation.currentAnimation);
            this.currentSimulation.currentAnimation = null;
        }
        
        if (this.currentElements.mergedRobots) {
            this.currentElements.mergedRobots.forEach(robotData => {
                if (robotData.simulationData) {
                    robotData.simulationData.isMoving = false;
                    robotData.simulationData.currentPath = [];
                }
            });
        }
        
        console.log('All processes stopped');
    }

    resetAllMergedRobotsToWarehouses() {
        console.log('Resetting all merged robots to warehouses...');

        this.currentElements.mergedRobots.forEach(robotData => {
            const warehouse = this.currentElements.mergedWarehouses.find(w => w.layerIndex === robotData.layerIndex);
            if (warehouse) {
                robotData.element.style.transition = 'none';
                robotData.element.style.left = warehouse.x + 'px';
                robotData.element.style.top = warehouse.y + 'px';

                this.updateRobotLabelPosition(robotData.element, robotData.label);
                robotData.infoElement.style.left = (warehouse.x + 20) + 'px';
                robotData.infoElement.style.top = (warehouse.y - 15) + 'px';

                console.log(`Reset robot ${robotData.layerIndex} to warehouse at (${warehouse.x}, ${warehouse.y})`);

                setTimeout(() => {
                    robotData.element.style.transition = '';
                }, 50);
            }
        });
    }

    resetConveyors() {
        this.conveyorSystems.forEach(system => {
            if (system.activeCabinet?.element?.parentNode) {
                this.workshop.removeChild(system.activeCabinet.element);
            }
            system.activeCabinet = null;
            system.lastCabinetTime = 0;
            system.segments.forEach(segment => {
                segment.hasCabinet = false;
            });
        });
    }

    // ========== АВТОМАТИЧЕСКАЯ МАРШРУТИЗАЦИЯ ==========

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

    generateAutoRouteForLayer(layer) {
        const elements = layer.elements;

        if (!elements.robot || !elements.warehouse || elements.posts.length === 0) {
            console.log('Cannot generate route: missing robot, warehouse, or posts');
            return;
        }

        if (!elements.robot.node) {
            elements.robot.node = this.findClosestNode(elements.robot);
            console.log('Auto-assigned robot node:', elements.robot.node);
        }

        if (!elements.warehouse.node) {
            elements.warehouse.node = this.findClosestNode(elements.warehouse);
            console.log('Auto-assigned warehouse node:', elements.warehouse.node);
        }

        const postsWithoutNodes = elements.posts.filter(post => !post.node);
        if (postsWithoutNodes.length > 0) {
            console.log('Some posts missing nodes, attempting to assign:', postsWithoutNodes.length);
            postsWithoutNodes.forEach(post => {
                post.node = this.findClosestNode(post.element);
                if (post.node) {
                    console.log('Assigned node to post:', post.conveyor, post.number);
                }
            });
        }

        const robotNode = elements.robot.node;
        const warehouseNode = elements.warehouse.node;

        if (!robotNode || !warehouseNode) {
            console.error('Cannot generate route: missing robot or warehouse nodes');
            return;
        }

        const postsWithNodes = elements.posts.filter(post => post.node);
        if (postsWithNodes.length === 0) {
            console.error('Cannot generate route: no posts with nodes');
            return;
        }

        const sortedPosts = [...postsWithNodes].sort((a, b) => {
            if (a.conveyor !== b.conveyor) return a.conveyor - b.conveyor;
            return a.number - b.number;
        });

        layer.simulation.postsToVisit = sortedPosts;
        layer.simulation.totalPosts = sortedPosts.length;
        layer.simulation.visitedPosts = 0;

        console.log('Auto route generated for', sortedPosts.length, 'posts');
        this.updatePostsVisited();
    }

    findClosestNode(element) {
        if (!element) return null;

        let elementX, elementY;

        if (element.style && element.style.left && element.style.top) {
            elementX = parseFloat(element.style.left);
            elementY = parseFloat(element.style.top);
        } else if (element.x !== undefined && element.y !== undefined) {
            elementX = element.x;
            elementY = element.y;
        } else if (element.getBoundingClientRect) {
            const rect = element.getBoundingClientRect();
            const workshopRect = this.workshop.getBoundingClientRect();
            elementX = rect.left - workshopRect.left + rect.width / 2;
            elementY = rect.top - workshopRect.top + rect.height / 2;
        } else {
            return null;
        }

        let closestNode = null;
        let minDistance = Infinity;
        const searchRadius = this.config.workshop.scale * 2;

        this.currentElements.pathNodes.forEach(node => {
            const distance = Math.sqrt(
                Math.pow(node.x - elementX, 2) + Math.pow(node.y - elementY, 2)
            );

            if (distance < minDistance && distance < searchRadius) {
                minDistance = distance;
                closestNode = node;
            }
        });

        if (closestNode) {
            console.log('Found closest node at distance:', minDistance, 'for element at:', elementX, elementY);
        } else {
            console.warn('No node found for element at:', elementX, elementY, 'within radius:', searchRadius);
        }

        return closestNode;
    }

    validateRoutes() {
        console.log('=== VALIDATING ROUTES ===');

        Object.values(this.layers).forEach(layer => {
            if (layer.id.startsWith('merged-')) return;

            const elements = layer.elements;
            let isValid = true;
            let issues = [];

            if (!elements.robot) {
                issues.push('No robot');
                isValid = false;
            }
            if (!elements.warehouse) {
                issues.push('No warehouse');
                isValid = false;
            }
            if (elements.posts.length === 0) {
                issues.push('No posts');
                isValid = false;
            }

            if (elements.robot && !elements.robot.node) {
                issues.push('Robot has no node');
                isValid = false;
            }
            if (elements.warehouse && !elements.warehouse.node) {
                issues.push('Warehouse has no node');
                isValid = false;
            }

            const postsWithoutNodes = elements.posts.filter(post => !post.node);
            if (postsWithoutNodes.length > 0) {
                issues.push(`${postsWithoutNodes.length} posts without nodes`);
                isValid = false;
            }

            if (layer.simulation.postsToVisit.length === 0) {
                issues.push('No route generated');
                isValid = false;
            }

            console.log(`Layer ${layer.id}: ${isValid ? 'VALID' : 'INVALID'}`, issues);

            if (!isValid && issues.length > 0) {
                console.log('Attempting to fix issues...');
                this.generateAutoRouteForLayer(layer);
            }
        });
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
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

    // ========== СОХРАНЕНИЕ И ЗАГРУЗКА ==========

    saveConfiguration() {
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
                segmentNumber: conv.segmentNumber,
                productionTime: this.conveyorSystems.find(sys => sys.id === conv.systemId)?.productionTime || 5400000
            })),
            
            posts: elements.posts.map(post => ({
                x: post.x,
                y: post.y,
                type: post.type || 'post',
                conveyor: post.conveyor || 1,
                number: post.number || 1,
                visited: post.visited || false,
                layerIndex: post.layerIndex
            })),
            
            pathNodes: elements.pathNodes.map(node => ({
                x: node.x,
                y: node.y,
                layerIndex: node.layerIndex
            })),
            
            pathLines: elements.pathLines.map(line => ({
                startX: line.startNode.x,
                startY: line.startNode.y,
                endX: line.endNode.x,
                endY: line.endNode.y,
                length: line.length,
                layerIndex: line.layerIndex
            }))
        };

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

    loadConfigurationData(data) {
        if (!data || !data.layers) {
            console.error('Invalid configuration data');
            alert('Некорректные данные конфигурации');
            return;
        }

        this.stopSimulation();
        const previousLayerId = this.currentLayerId;

        this.layers = {};
        this.layerCounter = 0;

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

        this.layerCounter = Object.keys(this.layers).length;
        this.currentLayerId = data.currentLayerId || Object.keys(this.layers)[0] || 'layer-0';

        this.workshop.innerHTML = '';
        this.createSnapPoints();

        Object.keys(data.layers).forEach(layerId => {
            this.restoreLayerElements(layerId, data.layers[layerId].elements);
        });

        this.switchLayer(this.currentLayerId);

        setTimeout(() => {
            this.restoreConnectionsAfterLoad();
        }, 500);

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

        const previousLayerId = this.currentLayerId;
        this.currentLayerId = layerId;

        if (!this.currentElements.mergedRobots) {
            this.currentElements.mergedRobots = [];
        }
        if (!this.currentElements.mergedWarehouses) {
            this.currentElements.mergedWarehouses = [];
        }

        if (elementsData.robot && !layerId.startsWith('merged-')) {
            this.restoreRobot(elementsData.robot);
        }

        if (elementsData.warehouse && !layerId.startsWith('merged-')) {
            this.restoreWarehouse(elementsData.warehouse);
        }

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

        this.currentLayerId = previousLayerId;
    }

    restoreConnectionsAfterLoad() {
        console.log('=== RESTORING CONNECTIONS AFTER LOAD ===');
        
        Object.values(this.layers).forEach(layer => {
            const elements = layer.elements;
            
            elements.posts.forEach(post => {
                if (!post.node) {
                    const closestNode = this.findClosestNodeInLayer(post.element, layer);
                    if (closestNode) {
                        post.node = closestNode;
                        console.log('Restored connection for post at', post.x, post.y, 'to node at', closestNode.x, closestNode.y);
                    }
                }
            });

            if (elements.robot && !elements.robot.node) {
                elements.robot.node = this.findClosestNodeInLayer(elements.robot, layer);
            }

            if (elements.warehouse && !elements.warehouse.node) {
                elements.warehouse.node = this.findClosestNodeInLayer(elements.warehouse, layer);
            }

            if (layer.id.startsWith('merged-')) {
                this.restoreConnectionsForMergedLayer();
            }
        });

        Object.values(this.layers).forEach(layer => {
            if (!layer.id.startsWith('merged-')) {
                this.generateAutoRouteForLayer(layer);
            }
        });

        console.log('Connections restoration completed');
    }

    restoreConnectionsForMergedLayer() {
        console.log('=== RESTORING CONNECTIONS FOR MERGED LAYER ===');
        
        this.currentElements.posts.forEach(post => {
            if (!post.node) {
                const layerIndex = post.layerIndex !== undefined ? post.layerIndex : this.detectLayerIndexForElement(post.x, post.y);
                
                if (layerIndex !== null && layerIndex !== undefined) {
                    const postNode = this.findMergedNode(post.element, layerIndex, this.currentLayer);
                    if (postNode) {
                        post.node = postNode;
                        post.layerIndex = layerIndex;
                        console.log('Restored connection for merged post at', post.x, post.y, 'to node at', postNode.x, postNode.y, 'layer:', layerIndex);
                    } else {
                        console.log('Creating new node for post at', post.x, post.y, 'with layerIndex:', layerIndex);
                        const newNode = this.placePathNode(post.x, post.y);
                        newNode.layerIndex = layerIndex;
                        post.node = newNode;
                        post.layerIndex = layerIndex;
                    }
                } else {
                    console.error('Cannot determine layerIndex for post at', post.x, post.y);
                }
            } else if (post.node && post.layerIndex === undefined) {
                post.layerIndex = post.node.layerIndex;
            }
        });

        if (this.currentElements.mergedRobots) {
            this.currentElements.mergedRobots.forEach(robot => {
                if (!robot.node) {
                    const robotX = parseFloat(robot.element.style.left);
                    const robotY = parseFloat(robot.element.style.top);
                    const newNode = this.placePathNode(robotX, robotY);
                    newNode.layerIndex = robot.layerIndex;
                    robot.node = newNode;
                    console.log('Created new node for merged robot at', robotX, robotY, 'layer:', robot.layerIndex);
                }
            });
        }

        if (this.currentElements.mergedWarehouses) {
            this.currentElements.mergedWarehouses.forEach(warehouse => {
                if (!warehouse.node) {
                    const newNode = this.placePathNode(warehouse.x, warehouse.y);
                    newNode.layerIndex = warehouse.layerIndex;
                    warehouse.node = newNode;
                    console.log('Created new node for merged warehouse at', warehouse.x, warehouse.y, 'layer:', warehouse.layerIndex);
                }
            });
        }

        console.log('Merged layer connections restoration completed');
    }

    detectLayerIndexForElement(x, y) {
        const offsets = [0, 1, 2, 3, 4, 5];
        
        for (const offset of offsets) {
            const originalX = x - offset;
            const originalY = y - offset;
            
            const originalLayers = Object.values(this.layers).filter(layer => !layer.id.startsWith('merged-'));
            
            for (const layer of originalLayers) {
                const hasMatchingElement = layer.elements.posts.some(post => 
                    Math.abs(post.x - originalX) < 5 && Math.abs(post.y - originalY) < 5
                ) || (layer.elements.robot && 
                    Math.abs(parseFloat(layer.elements.robot.style.left) - originalX) < 5 && 
                    Math.abs(parseFloat(layer.elements.robot.style.top) - originalY) < 5
                ) || (layer.elements.warehouse && 
                    Math.abs(parseFloat(layer.elements.warehouse.style.left) - originalX) < 5 && 
                    Math.abs(parseFloat(layer.elements.warehouse.style.top) - originalY) < 5
                );
                
                if (hasMatchingElement) {
                    const layerIndex = parseInt(layer.id.split('-')[1]) || 0;
                    console.log('Detected layerIndex', layerIndex, 'for element at', x, y, 'original coords:', originalX, originalY);
                    return layerIndex;
                }
            }
        }
        
        console.warn('Could not detect layerIndex for element at', x, y);
        return null;
    }

    restoreMergedRobot(robotData) {
        console.log('Restoring merged robot:', robotData);

        const robot = document.createElement('div');
        robot.className = 'element robot robot-merged';
        robot.style.left = robotData.x + 'px';
        robot.style.top = robotData.y + 'px';
        robot.style.width = '40px';
        robot.style.height = '40px';

        const color = robotData.color || this.getColorByLayerIndex(robotData.layerIndex);
        robot.style.border = `3px solid ${color}`;
        robot.style.borderRadius = '50%';
        robot.style.zIndex = 20 + (robotData.layerIndex || 0);
        robot.style.background = 'rgba(255, 255, 255, 0.8)';

        const robotImage = robotData.type === 'bigRobot' ? this.config.images.bigRobot : this.config.images.robot;
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

        const robotNode = this.placePathNode(robotData.x, robotData.y);
        robotNode.layerIndex = robotData.layerIndex;

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
            simulationData: null,
            node: robotNode
        };

        this.workshop.appendChild(robot);
        this.workshop.appendChild(label);
        this.workshop.appendChild(info);

        this.updateRobotLabelPosition(robot, label);
        info.style.left = (robotData.x + 20) + 'px';
        info.style.top = (robotData.y - 15) + 'px';

        if (!this.currentElements.mergedRobots) {
            this.currentElements.mergedRobots = [];
        }

        this.currentElements.mergedRobots.push(robotObj);
        console.log('Merged robot restored successfully with node');
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

        const postImage = postData.type === 'uis' ? this.config.images.uis : this.config.images.post;
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
            visited: postData.visited || false,
            layerIndex: postData.layerIndex
        };

        this.currentElements.posts.push(postObj);

        if (this.currentLayerId.startsWith('merged-')) {
            if (postData.layerIndex !== undefined) {
                const postNode = this.findMergedNode(post, postData.layerIndex, this.currentLayer);
                if (postNode) {
                    postObj.node = postNode;
                    console.log('Restored node for merged post:', postData.conveyor, postData.number, 'layer:', postData.layerIndex);
                } else {
                    console.warn('Could not find node for merged post:', postData.conveyor, postData.number, 'layer:', postData.layerIndex);
                    const newNode = this.placePathNode(postData.x, postData.y);
                    newNode.layerIndex = postData.layerIndex;
                    postObj.node = newNode;
                    console.log('Created new node for post:', postData.conveyor, postData.number, 'with layerIndex:', postData.layerIndex);
                }
            } else {
                console.error('Missing layerIndex for merged post:', postData);
                const detectedLayerIndex = this.detectLayerIndexForElement(postData.x, postData.y);
                if (detectedLayerIndex !== null) {
                    postObj.layerIndex = detectedLayerIndex;
                    const newNode = this.placePathNode(postData.x, postData.y);
                    newNode.layerIndex = detectedLayerIndex;
                    postObj.node = newNode;
                    console.log('Detected layerIndex', detectedLayerIndex, 'for post at', postData.x, postData.y);
                }
            }
        } else {
            const postNode = this.placePathNode(postData.x, postData.y);
            postObj.node = postNode;
        }
    }

    restorePathNode(nodeData) {
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
            if (this.deleteMode) {
                this.removePathNode(node);
            } else if (this.selectedTool === 'path') {
                this.connectToNode(node);
            }
        });
    
        this.workshop.appendChild(node);
    
        const nodeObj = {
            element: node,
            x: nodeData.x,
            y: nodeData.y,
            connections: [],
            layerIndex: nodeData.layerIndex
        };
    
        this.currentElements.pathNodes.push(nodeObj);
        return nodeObj;
    }

    restoreConveyors(conveyorsData) {
        console.log('Restoring conveyor systems from saved data:', conveyorsData);
        
        const systems = {};
        conveyorsData.forEach(conv => {
            const systemId = conv.systemId || 'conveyor-system-' + Date.now();
            if (!systems[systemId]) {
                systems[systemId] = [];
            }
            systems[systemId].push(conv);
        });

        console.log('Found conveyor systems to restore:', Object.keys(systems).length);

        Object.keys(systems).forEach(systemId => {
            const segments = systems[systemId];
            if (segments.length > 0) {
                const firstSegment = segments[0];
                const productionTime = firstSegment.productionTime || 5400000;
                
                this.createConveyorSystem(
                    firstSegment.x, 
                    firstSegment.y, 
                    systemId, 
                    productionTime
                );
                console.log('Restored conveyor system:', systemId, 'at exact position (', firstSegment.x, ',', firstSegment.y, ') with', segments.length, 'segments');
            }
        });
    }

    restorePathLine(lineData) {
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

        line.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.deleteMode) {
                console.log('Deleting restored path line in delete mode');
                this.removePathLine(line);
            }
        });

        this.workshop.appendChild(line);

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
        this.placePathNode(warehouseData.x, warehouseData.y);
    }

    restoreRobot(robotData) {
        const robot = document.createElement('div');
        robot.className = 'element robot';
        robot.style.left = robotData.x + 'px';
        robot.style.top = robotData.y + 'px';

        const robotImage = robotData.type === 'bigRobot' ? this.config.images.bigRobot : this.config.images.robot;
        robot.innerHTML = `<img src="${robotImage}" alt="Робот" style="width:100%;height:100%;">`;
        robot.dataset.robotType = robotData.type;

        this.workshop.appendChild(robot);
        this.currentElements.robot = robot;

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

        this.currentElements.robot.speed = robotData.speed;
        this.currentElements.robot.postStopTime = robotData.postStopTime;
        this.currentElements.robot.warehouseStopTime = robotData.warehouseStopTime;
        this.currentElements.robot.infoElement = info;
        this.currentElements.robot.type = robotData.type;

        this.placePathNode(robotData.x, robotData.y);
    }

    prepareMergedSimulationData(sourceLayer, layerIndex, mergedLayer) {
        console.log('Preparing simulation data for layer:', sourceLayer.id, 'index:', layerIndex);
        console.log('Source layer posts:', sourceLayer.elements.posts?.length || 0);
        console.log('Merged layer posts:', mergedLayer.elements.posts?.length || 0);
    
        if (!sourceLayer || !sourceLayer.elements.robot || !sourceLayer.elements.warehouse || !sourceLayer.elements.posts || sourceLayer.elements.posts.length === 0) {
            console.log('Missing required elements for layer:', sourceLayer ? sourceLayer.id : 'no layer',
                'robot:', !!sourceLayer?.elements?.robot,
                'warehouse:', !!sourceLayer?.elements?.warehouse,
                'posts:', sourceLayer?.elements?.posts?.length || 0);
            return null;
        }
    
        const robotNode = this.findMergedNode(sourceLayer.elements.robot, layerIndex, mergedLayer);
        const warehouseNode = this.findMergedNode(sourceLayer.elements.warehouse, layerIndex, mergedLayer);
    
        console.log('Found merged nodes - robot:', !!robotNode, 'warehouse:', !!warehouseNode);
    
        if (!robotNode || !warehouseNode) {
            console.log('Could not find merged nodes for layer:', sourceLayer.id,
                'robotNode:', !!robotNode, 'warehouseNode:', !!warehouseNode);
            return null;
        }
    
        const layerPosts = mergedLayer.elements.posts.filter(post => 
            post.layerIndex === layerIndex
        );
    
        console.log('Found posts in merged layer for layer', layerIndex, ':', layerPosts.length);
    
        if (layerPosts.length === 0) {
            console.log('No posts found in merged layer for layer:', layerIndex);
            return null;
        }
    
        const postsWithNodes = [];
        layerPosts.forEach(post => {
            if (!post.node) {
                post.node = this.findMergedNode(post.element, layerIndex, mergedLayer);
            }
            if (post.node) {
                postsWithNodes.push(post);
            } else {
                console.log('Could not find node for post in merged layer:', post.conveyor, post.number);
            }
        });
    
        if (postsWithNodes.length === 0) {
            console.log('No posts with nodes found for layer:', sourceLayer.id);
            return null;
        }
    
        const sortedPosts = [...postsWithNodes].sort((a, b) => {
            if (a.conveyor !== b.conveyor) return a.conveyor - b.conveyor;
            return a.number - b.number;
        });
    
        console.log('Successfully prepared simulation data for', sortedPosts.length, 'posts in merged layer');
    
        return {
            robotNode: robotNode,
            warehouseNode: warehouseNode,
            posts: sortedPosts,
            currentPostIndex: 0,
            currentPath: [],
            isMoving: false,
            layerIndex: layerIndex,
            speed: sourceLayer.elements.robot.speed || 0.6,
            postStopTime: sourceLayer.elements.robot.postStopTime || 30,
            warehouseStopTime: sourceLayer.elements.robot.warehouseStopTime || 300
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RobotSimulation(config);
});