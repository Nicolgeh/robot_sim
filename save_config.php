<?php
// Сохранение конфигурации
header('Content-Type: application/json');

// Разрешаем CORS если нужно
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode([
            'success' => false, 
            'message' => 'Ошибка JSON: ' . json_last_error_msg()
        ]);
        exit;
    }
    
    if ($data) {
        // Проверяем существование директории
        $filename = 'saved_config.json';
        
        // Сохраняем конфигурацию в файл
        if (file_put_contents($filename, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
            echo json_encode([
                'success' => true, 
                'message' => 'Конфигурация сохранена'
            ]);
        } else {
            echo json_encode([
                'success' => false, 
                'message' => 'Ошибка записи файла. Проверьте права доступа.'
            ]);
        }
    } else {
        echo json_encode([
            'success' => false, 
            'message' => 'Получены пустые данные'
        ]);
    }
} else {
    echo json_encode([
        'success' => false, 
        'message' => 'Недопустимый метод запроса. Используйте POST.'
    ]);
}
?>