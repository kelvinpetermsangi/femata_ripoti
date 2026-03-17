from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
LOCALES_DIR = REPO_ROOT / "frontend" / "src" / "locales" / "shared"
PROGRESS_DIR = REPO_ROOT / "frontend" / ".tmp" / "admin_locale_translation"
ENGLISH_ADMIN_PATH = LOCALES_DIR / "en" / "admin.json"

TARGET_LANGUAGES = {
    "zh": "Simplified Chinese",
    "hi": "Hindi",
    "bn": "Bengali",
    "ar": "Arabic",
    "de": "German",
    "am": "Amharic",
    "ko": "Korean",
    "th": "Thai",
}

CHUNK_SIZE = 45
MAX_RETRIES = 4


def load_local_env_files() -> None:
    for candidate in (BACKEND_DIR / ".env", BACKEND_DIR / ".env.local"):
        if not candidate.exists():
            continue
        try:
            lines = candidate.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue
        for raw_line in lines:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()
            if not key or key in os.environ:
                continue
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
                value = value[1:-1]
            os.environ[key] = value


def chunk_items(items: list[tuple[str, object]], size: int) -> Iterable[list[tuple[str, object]]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


def extract_json_object(payload: str) -> dict[str, object]:
    text = payload.strip()
    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 3:
            text = parts[1]
            if text.startswith("json"):
                text = text[4:].lstrip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Model response did not contain a JSON object.")
    return json.loads(text[start : end + 1])


def deepseek_chat(messages: list[dict[str, str]]) -> str:
    api_key = (os.getenv("DEEPSEEK_API_KEY", "") or "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not configured.")

    base_url = (os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com") or "https://api.deepseek.com").strip().rstrip("/")
    model = (os.getenv("DEEPSEEK_CHAT_MODEL", os.getenv("DEEPSEEK_MODEL", "deepseek-chat")) or "deepseek-chat").strip() or "deepseek-chat"
    timeout_seconds = max(90, int((os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "45") or "45").strip() or "45"))

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 4000,
        "stream": False,
    }
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        body = json.loads(response.read().decode("utf-8"))
    return body["choices"][0]["message"]["content"]


def translate_chunk(language_name: str, chunk: dict[str, object]) -> dict[str, object]:
    chunk_json = json.dumps(chunk, ensure_ascii=False, indent=2)
    system_prompt = (
        "You are a professional software localizer. Translate FEMATA admin dashboard UI strings from English into the requested target language. "
        "Return only a valid JSON object with exactly the same keys as the input. Preserve placeholders like {{count}}, {{name}}, {{region}}, "
        "{{version}}, punctuation, arrays, line breaks, and markdown-style emphasis if present. Keep product names such as FEMATA, Michelle, and Melvin unchanged. "
        "Use clear, natural UI language for an administrative web application."
    )
    user_prompt = (
        f"Translate this JSON object into {language_name}. Use the native script for the language.\n"
        "Important rules:\n"
        "- Keep the keys exactly the same.\n"
        "- Preserve all placeholders exactly.\n"
        "- Preserve array shapes and the JSON structure.\n"
        "- Return JSON only, with no explanation.\n\n"
        f"{chunk_json}"
    )

    response = deepseek_chat(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
    )
    translated = extract_json_object(response)

    expected_keys = list(chunk.keys())
    translated_keys = list(translated.keys())
    if translated_keys != expected_keys:
        missing = [key for key in expected_keys if key not in translated]
        extras = [key for key in translated_keys if key not in chunk]
        raise ValueError(f"Key mismatch. Missing: {missing[:5]} Extras: {extras[:5]}")
    return translated


def ordered_output(source: dict[str, object], translated: dict[str, object]) -> dict[str, object]:
    return {key: translated[key] for key in source.keys()}


def translate_language(code: str, language_name: str, source: dict[str, object]) -> None:
    PROGRESS_DIR.mkdir(parents=True, exist_ok=True)
    progress_path = PROGRESS_DIR / f"{code}.json"
    target_path = LOCALES_DIR / code / "admin.json"
    target_path.parent.mkdir(parents=True, exist_ok=True)

    partial: dict[str, object] = {}
    if progress_path.exists():
        partial = json.loads(progress_path.read_text(encoding="utf-8"))

    remaining_items = [(key, value) for key, value in source.items() if key not in partial]
    total_chunks = max(1, (len(remaining_items) + CHUNK_SIZE - 1) // CHUNK_SIZE)

    for chunk_index, chunk_items_list in enumerate(chunk_items(remaining_items, CHUNK_SIZE), start=1):
        chunk = {key: value for key, value in chunk_items_list}
        last_error: Exception | None = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                translated_chunk = translate_chunk(language_name, chunk)
                partial.update(translated_chunk)
                progress_path.write_text(json.dumps(partial, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                print(f"[{code}] translated chunk {chunk_index}/{total_chunks} on attempt {attempt}", flush=True)
                break
            except Exception as error:  # noqa: BLE001
                last_error = error
                wait_seconds = attempt * 3
                print(f"[{code}] retry {attempt}/{MAX_RETRIES} after error: {error}", flush=True)
                time.sleep(wait_seconds)
        else:
            raise RuntimeError(f"Failed translating {code} chunk {chunk_index}/{total_chunks}") from last_error

    final_output = ordered_output(source, partial)
    target_path.write_text(json.dumps(final_output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if progress_path.exists():
        progress_path.unlink()
    print(f"[{code}] wrote {target_path}", flush=True)


def main() -> int:
    load_local_env_files()
    source = json.loads(ENGLISH_ADMIN_PATH.read_text(encoding="utf-8"))

    selected_codes = sys.argv[1:] or list(TARGET_LANGUAGES.keys())
    invalid_codes = [code for code in selected_codes if code not in TARGET_LANGUAGES]
    if invalid_codes:
        raise SystemExit(f"Unsupported codes: {', '.join(invalid_codes)}")

    for code in selected_codes:
        translate_language(code, TARGET_LANGUAGES[code], source)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
