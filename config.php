<?php
// Конфигурация симуляции
function getConfig()
{
    return [
        'robot' => [
            'speed' => 0.6, // м/с
            'stop_time_post' => 30, // секунды
            'stop_time_warehouse' => 300 // секунды (5 минут)
        ],
        'workshop' => [
            'width' => 2000, // увеличенная ширина
            'height' => 2000, // увеличенная высота
            'scale' => 50 // 50 пикселей на метр
        ],
        'conveyors' => [
            'count' => 3,
            'posts_per_side' => 24,
            'post_spacing' => 5 // метров между постами
        ],
        'images' => [
            'robot' => 'images/robot.svg',
            'bigRobot' => 'images/bigRobot.svg', // ДОБАВИТЬ
            'warehouse' => 'images/warehouse.svg',
            'conveyor' => 'images/conveyor.svg',
            'post' => 'images/post.svg',
            'uis' => 'images/uis.svg' // ДОБАВИТЬ
        ]
    ];
}
