<?php
/**
 * Plugin Name: 影武者AI
 * Description: [kagemusha_ai_chat] で右下チャットボタンを表示し、Vercel上のチャットモーダルを起動します。
 * Version: 0.1.0
 * Author: B'Me
 */

if (!defined('ABSPATH')) {
	exit;
}

function kagemusha_ai_chat_shortcode($atts = array()) {
	$atts = shortcode_atts(
		array(
			'app_url' => 'https://kagemusha-ai.vercel.app',
			'button_label' => 'AIチャットで相談',
			'modal_title' => "B'Me AI相談チャット",
			'iframe_path' => '/embed/chat',
		),
		$atts,
		'kagemusha_ai_chat'
	);

	$app_url = untrailingslashit(esc_url_raw($atts['app_url']));
	$script_src = esc_url($app_url . '/api/widget');

	$button_label = esc_attr($atts['button_label']);
	$modal_title = esc_attr($atts['modal_title']);
	$iframe_path = esc_attr($atts['iframe_path']);
	$app_url_attr = esc_attr($app_url);

	return '<script data-kagemusha-ai-chat-widget="1" src="' . $script_src . '" data-app-url="' . $app_url_attr . '" data-button-label="' . $button_label . '" data-modal-title="' . $modal_title . '" data-iframe-path="' . $iframe_path . '" defer></script>';
}

add_shortcode('kagemusha_ai_chat', 'kagemusha_ai_chat_shortcode');
