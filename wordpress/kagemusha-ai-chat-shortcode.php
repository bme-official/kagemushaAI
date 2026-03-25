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

function kagemusha_ai_build_avatar_settings_json($atts) {
	$raw_avatar_settings = isset($atts['avatar_settings']) ? trim((string) $atts['avatar_settings']) : '';
	if ($raw_avatar_settings !== '') {
		return $raw_avatar_settings;
	}

	$settings = array();

	$string_fields = array(
		'model_url' => 'modelUrl',
		'avatar_name' => 'avatarName',
		'avatar_name_kana' => 'avatarNameKana',
		'avatar_age' => 'avatarAge',
		'company_name' => 'companyName',
		'company_name_kana' => 'companyNameKana',
		'voice_model' => 'voiceModel',
		'profile' => 'profile',
	);

	foreach ($string_fields as $att_key => $json_key) {
		$value = isset($atts[$att_key]) ? trim((string) $atts[$att_key]) : '';
		if ($value !== '') {
			$settings[$json_key] = $value;
		}
	}

	$json_fields = array(
		'services_json' => 'services',
		'statuses_json' => 'statuses',
		'status_mappings_json' => 'statusMappings',
	);
	foreach ($json_fields as $att_key => $json_key) {
		$value = isset($atts[$att_key]) ? trim((string) $atts[$att_key]) : '';
		if ($value === '') {
			continue;
		}
		$decoded = json_decode($value, true);
		if (json_last_error() === JSON_ERROR_NONE) {
			$settings[$json_key] = $decoded;
		}
	}

	if (empty($settings)) {
		return '';
	}

	return wp_json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function kagemusha_ai_chat_shortcode($atts = array()) {
	global $kagemusha_ai_chat_widget_config;

	$atts = shortcode_atts(
		array(
			'app_url' => 'https://kagemusha-ai.vercel.app',
			'button_label' => 'AIコンシェルジュ',
			'modal_title' => "AIコンシェルジュ",
			'iframe_path' => '/embed/chat',
			'avatar_settings' => '',
			'model_url' => '',
			'avatar_name' => '',
			'avatar_name_kana' => '',
			'avatar_age' => '',
			'company_name' => '',
			'company_name_kana' => '',
			'voice_model' => '',
			'profile' => '',
			'services_json' => '',
			'statuses_json' => '',
			'status_mappings_json' => '',
		),
		$atts,
		'kagemusha_ai_chat'
	);

	$app_url = untrailingslashit(esc_url_raw($atts['app_url']));
	$script_src = esc_url($app_url . '/api/widget');

	$button_label = esc_attr($atts['button_label']);
	$modal_title = esc_attr($atts['modal_title']);
	$iframe_path = esc_attr($atts['iframe_path']);
	$avatar_settings = kagemusha_ai_build_avatar_settings_json($atts);
	$app_url_attr = esc_attr($app_url);

	$kagemusha_ai_chat_widget_config = array(
		'script_src' => $script_src,
		'app_url' => $app_url_attr,
		'button_label' => $button_label,
		'modal_title' => $modal_title,
		'iframe_path' => $iframe_path,
		'avatar_settings' => $avatar_settings,
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
			$default_avatar_settings = defined('KAGEMUSHA_AI_DEFAULT_AVATAR_SETTINGS')
				? (string) KAGEMUSHA_AI_DEFAULT_AVATAR_SETTINGS
				: '';
			$kagemusha_ai_chat_widget_config = array(
				'script_src' => esc_url($default_app_url . '/api/widget'),
				'app_url' => esc_attr($default_app_url),
				'button_label' => esc_attr('AIコンシェルジュ'),
				'modal_title' => esc_attr("AIコンシェルジュ"),
				'iframe_path' => esc_attr('/embed/chat'),
				'avatar_settings' => $default_avatar_settings,
			);
		} else {
			return;
		}
	}

	$config = $kagemusha_ai_chat_widget_config;
	echo "\n<!-- kagemusha-ai-chat: script injected -->\n";
	echo '<script data-kagemusha-ai-chat-widget="1" src="' . esc_url($config['script_src']) . '" data-app-url="' . esc_attr($config['app_url']) . '" data-button-label="' . esc_attr($config['button_label']) . '" data-modal-title="' . esc_attr($config['modal_title']) . '" data-iframe-path="' . esc_attr($config['iframe_path']) . '" data-avatar-settings="' . esc_attr($config['avatar_settings'] ?? '') . '" defer></script>';
	$kagemusha_ai_chat_widget_rendered = true;
}

add_action('wp_footer', 'kagemusha_ai_chat_render_footer_script', 99);
add_action('wp_body_open', 'kagemusha_ai_chat_render_footer_script', 99);
add_action('wp_head', 'kagemusha_ai_chat_render_footer_script', 99);
