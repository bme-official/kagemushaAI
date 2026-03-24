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

global $kagemusha_ai_chat_widget_config;
$kagemusha_ai_chat_widget_config = null;

global $kagemusha_ai_chat_widget_rendered;
$kagemusha_ai_chat_widget_rendered = false;

function kagemusha_ai_chat_shortcode($atts = array()) {
	global $kagemusha_ai_chat_widget_config;

	$atts = shortcode_atts(
		array(
			'app_url' => 'https://kagemusha-ai.vercel.app',
			'button_label' => 'AIチャットで相談',
			'modal_title' => "お問い合わせAIチャット",
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

	$kagemusha_ai_chat_widget_config = array(
		'script_src' => $script_src,
		'app_url' => $app_url_attr,
		'button_label' => $button_label,
		'modal_title' => $modal_title,
		'iframe_path' => $iframe_path,
	);

	return '';
}

add_shortcode('kagemusha_ai_chat', 'kagemusha_ai_chat_shortcode');
add_shortcode('bme_ai_chat', 'kagemusha_ai_chat_shortcode');

function kagemusha_ai_chat_render_footer_script() {
	global $kagemusha_ai_chat_widget_config;
	global $kagemusha_ai_chat_widget_rendered;

	if (is_admin() || $kagemusha_ai_chat_widget_rendered) {
		return;
	}

	// Fallback: ショートコードが評価されないテーマでも contact 系URLなら自動で注入する
	if (empty($kagemusha_ai_chat_widget_config)) {
		$request_uri = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field(wp_unslash($_SERVER['REQUEST_URI'])) : '';
		if (strpos($request_uri, 'contact') !== false || strpos($request_uri, 'お問い合わせ') !== false) {
			$default_app_url = 'https://kagemusha-ai.vercel.app';
			$kagemusha_ai_chat_widget_config = array(
				'script_src' => esc_url($default_app_url . '/api/widget'),
				'app_url' => esc_attr($default_app_url),
				'button_label' => esc_attr('AIチャットで相談'),
				'modal_title' => esc_attr("お問い合わせAIチャット"),
				'iframe_path' => esc_attr('/embed/chat'),
			);
		} else {
			return;
		}
	}

	$config = $kagemusha_ai_chat_widget_config;
	echo "\n<!-- kagemusha-ai-chat: script injected -->\n";
	echo '<script data-kagemusha-ai-chat-widget="1" src="' . esc_url($config['script_src']) . '" data-app-url="' . esc_attr($config['app_url']) . '" data-button-label="' . esc_attr($config['button_label']) . '" data-modal-title="' . esc_attr($config['modal_title']) . '" data-iframe-path="' . esc_attr($config['iframe_path']) . '" defer></script>';
	$kagemusha_ai_chat_widget_rendered = true;
}

add_action('wp_footer', 'kagemusha_ai_chat_render_footer_script', 99);
add_action('wp_body_open', 'kagemusha_ai_chat_render_footer_script', 99);
add_action('wp_head', 'kagemusha_ai_chat_render_footer_script', 99);
