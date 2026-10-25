/**
 * Иконки провайдеров моделей: источник — SVG из `src/lib/assets`.
 * Монохромные (fill="currentColor") красятся цветом темы через CSS-маску,
 * цветные рендерятся как <img>. Anthropic в наборе нет — иконка инлайном
 * в ModelPicker.svelte.
 */
import antigravity from '../assets/antigravity-color.svg';
import deepseek from '../assets/deepseek-color.svg';
import gemini from '../assets/gemini-color.svg';
import copilot from '../assets/githubcopilot.svg';
import grok from '../assets/grok.svg';
import kimi from '../assets/kimi-color.svg';
import manus from '../assets/manus.svg';
import meta from '../assets/meta-color.svg';
import mistral from '../assets/mistral-color.svg';
import ollama from '../assets/ollama.svg';
import openai from '../assets/openai.svg';
import perplexity from '../assets/perplexity-color.svg';
import qwen from '../assets/qwen-color.svg';
import yandex from '../assets/yandex.svg';
import zai from '../assets/zai.svg';

export interface ProviderIcon {
	src: string;
	/** true — монохромная иконка, красится currentColor. */
	mono: boolean;
}

/** Ключи — семейства моделей из `modelFamily()` в нижнем регистре. */
export const PROVIDER_ICONS: Record<string, ProviderIcon> = {
	openai: { src: openai, mono: true },
	'openai o-серия': { src: openai, mono: true },
	gpt: { src: openai, mono: true },
	google: { src: gemini, mono: false },
	gemini: { src: gemini, mono: false },
	xai: { src: grok, mono: true },
	grok: { src: grok, mono: true },
	deepseek: { src: deepseek, mono: false },
	mistral: { src: mistral, mono: false },
	qwen: { src: qwen, mono: false },
	llama: { src: meta, mono: false },
	kimi: { src: kimi, mono: false },
	glm: { src: zai, mono: true },
	perplexity: { src: perplexity, mono: false },
	copilot: { src: copilot, mono: true },
	manus: { src: manus, mono: true },
	yandex: { src: yandex, mono: true },
	antigravity: { src: antigravity, mono: false },
	ollama: { src: ollama, mono: true }
};

/** Иконка по семейству модели; null — провайдер не распознан. */
export function providerIcon(family: string): ProviderIcon | null {
	return PROVIDER_ICONS[family.toLowerCase()] ?? null;
}
