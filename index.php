<?php
include 'config.php';
$config = getConfig();
?>
<!DOCTYPE html>
<html lang="ru">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Симуляция робота-тележки</title>
    <link rel="stylesheet" href="css/style.css">
</head>

<body>
    <div class="container">
        <h1>Симуляция перемещения робота-тележки по цеху</h1>

        <div class="controls">
            <button id="save-btn">Сохранить конфигурацию</button>
            <button id="load-btn">Загрузить конфигурацию</button>
            <button id="start-btn">Запуск симуляции</button>
            <button id="stop-btn">Остановка</button>
            <button id="resume-btn">Снять с остановки</button>
            <button id="reset-btn">Перезапуск</button>
            <button id="delete-btn">Удалить объекты</button>
            <button id="auto-route-btn">Автомаршрут</button>
            <button id="debug-btn">Отладка совмещения</button>
            <button id="debug-nodes-btn">Отладка узлов</button>
            <button id="debug-positions-btn">Отладка позиций</button>
        </div>

        <div class="layers-panel">
            <h3>Управление слоями</h3>
            <div class="layers-controls">
                <button id="add-layer-btn">Добавить слой</button>
                <button id="remove-layer-btn">Удалить слой</button>
                <button id="merge-layers-btn">Совместить слои</button>
                <select id="layer-select"></select>
                <div id="current-layer">Текущий слой: Слой 1</div>
            </div>
        </div>

        <!-- УБРАН БЛОК НАСТРОЕК РОБОТА -->

        <div class="editor-container">
            <div class="toolbar">
                <div class="tool" data-tool="robot">
                    <img src="<?php echo $config['images']['robot']; ?>" alt="Робот" class="tool-icon">
                    <span>Робот</span>
                </div>
                <div class="tool" data-tool="big-robot">
                    <img src="<?php echo $config['images']['bigRobot']; ?>" alt="Большой робот" class="tool-icon">
                    <span>Большой робот</span>
                </div>
                <div class="tool" data-tool="warehouse">
                    <img src="<?php echo $config['images']['warehouse']; ?>" alt="Склад" class="tool-icon">
                    <span>Склад</span>
                </div>
                <div class="tool" data-tool="conveyor">
                    <img src="<?php echo $config['images']['conveyor']; ?>" alt="Конвейер" class="tool-icon">
                    <span>Конвейер</span>
                </div>
                <div class="tool" data-tool="post">
                    <img src="<?php echo $config['images']['post']; ?>" alt="Пост" class="tool-icon">
                    <span>Пост</span>
                </div>
                <div class="tool" data-tool="uis">
                    <img src="<?php echo $config['images']['uis']; ?>" alt="УИС" class="tool-icon">
                    <span>УИС</span>
                </div>
                <div class="tool" data-tool="path">
                    <div class="element-preview path">●</div>
                    <span>Путь движения</span>
                </div>
                <div class="tool" data-tool="node">
                    <div class="element-preview node">○</div>
                    <span>Узел пути</span>
                </div>
            </div>

            <div class="workshop" id="workshop">
                <!-- Здесь будет отрисовываться цех -->
            </div>
        </div>

        <div class="status-panel">
            <h3>Статус симуляции</h3>
            <div id="status">Готов к работе</div>
            <div id="robot-status">Робот не активен</div>
            <div id="current-position">Позиция: не определена</div>
            <div id="next-stop">Следующая остановка: не определена</div>
            <div id="path-length">Общая длина пути: 0 м</div>
            <div id="posts-visited">Посещено постов: 0/0</div>
        </div>
    </div>

    <!-- Модальное окно для ввода данных поста -->
    <div id="post-modal" class="modal">
        <div class="modal-content">
            <h3>Настройка поста</h3>
            <div class="modal-input">
                <label>Номер конвейера:</label>
                <input type="number" id="conveyor-number" min="1" max="3" value="1">
            </div>
            <div class="modal-input">
                <label>Номер поста:</label>
                <input type="number" id="post-number" min="1" max="12" value="1">
            </div>
            <div class="modal-buttons">
                <button id="save-post">Сохранить</button>
                <button id="cancel-post">Отмена</button>
            </div>
        </div>
    </div>

    <!-- Модальное окно для ввода длины соединения -->
    <div id="connection-modal" class="modal">
        <div class="modal-content">
            <h3>Введите длину пути</h3>
            <div class="modal-input">
                <label>Длина пути (метры):</label>
                <input type="number" id="connection-length" step="0.1" placeholder="Длина в метрах">
            </div>
            <div class="modal-buttons">
                <button id="save-connection">Сохранить</button>
                <button id="cancel-connection">Отмена</button>
            </div>
        </div>
    </div>

    <!-- Модальное окно для редактирования длины линии -->
    <div id="length-modal" class="modal">
        <div class="modal-content">
            <h3>Редактирование длины пути</h3>
            <div class="modal-input">
                <label>Длина пути (метры):</label>
                <input type="number" id="line-length" step="0.1" placeholder="Длина в метрах">
            </div>
            <div class="modal-buttons">
                <button id="save-length">Сохранить</button>
                <button id="cancel-length">Отмена</button>
            </div>
        </div>
    </div>

    <!-- Модальное окно для настройки робота -->
    <div id="robot-modal" class="modal">
        <div class="modal-content">
            <h3>Настройка робота</h3>
            <div class="modal-input">
                <label>Скорость робота (м/с):</label>
                <input type="number" id="robot-speed-input" step="0.1" value="0.6" min="0.1" max="10">
            </div>
            <div class="modal-input">
                <label>Время на постах (сек):</label>
                <input type="number" id="robot-post-time" value="30" min="1" max="600">
            </div>
            <div class="modal-input">
                <label>Время на складе (сек):</label>
                <input type="number" id="robot-warehouse-time" value="300" min="1" max="1800">
            </div>
            <div class="modal-buttons">
                <button id="save-robot">Сохранить</button>
                <button id="cancel-robot">Отмена</button>
            </div>
        </div>
    </div>

    <!-- Модальное окно для настройки конвейера -->
    <div id="conveyor-modal" class="modal">
        <div class="modal-content">
            <h3>Настройка конвейера</h3>
            <div class="modal-input">
                <label>Время сборки шкафа (минуты):</label>
                <input type="number" id="conveyor-production-time" value="90" min="1" max="480">
            </div>
            <div class="modal-buttons">
                <button id="save-conveyor">Сохранить</button>
                <button id="cancel-conveyor">Отмена</button>
            </div>
        </div>
    </div>

    <script>
    const config = <?php echo json_encode($config); ?>;
    </script>
    <script src="js/simulation.js"></script>
</body>

</html>