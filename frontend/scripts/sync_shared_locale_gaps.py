from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
LOCALES_DIR = REPO_ROOT / "frontend" / "src" / "locales" / "shared"
EN_COMMON_PATH = LOCALES_DIR / "en" / "common.json"
EN_REPORT_PATH = LOCALES_DIR / "en" / "report.json"

TARGET_LANGUAGES = {
    "sw": "Swahili",
    "fr": "French",
    "zh": "Simplified Chinese",
    "hi": "Hindi",
    "bn": "Bengali",
    "ar": "Arabic",
    "de": "German",
    "am": "Amharic",
    "ko": "Korean",
    "th": "Thai",
}

COMMON_SOURCE_UPDATES: dict[str, str] = {
    "chatBrandName": "FEMATA",
    "chatModalTitle": "Talk to FEMATA Agent",
    "chatModalDesc": "Ask questions about mining safety, reporting process, or get guidance in your preferred language.",
    "chatAssistantTitle": "FEMATA Agent",
    "chatAssistantDesc": "Available at any time to guide you on mining safety, reporting, and anonymous follow-up.",
    "chatCapabilitiesTitle": "What I can help with",
    "chatCapabilityReporting": "Reporting procedures",
    "chatCapabilitySafety": "Safety guidance",
    "chatCapabilityTracking": "Tracking your report",
    "chatCapabilityLanguage": "Language guidance",
    "chatQuickTipsTitle": "Quick tips",
    "chatQuickTipsBody": "Ask short, specific questions about reporting, tracking, safety, or privacy to get the clearest guidance.",
    "chatQuickQuestionsTitle": "Quick questions",
    "documentOpen": "Open",
    "documentSectionLabel": "Section {{num}}",
    "documentView": "View",
    "languageCurrentLabel": "Current language",
    "languageEmptyState": "No languages matched your search.",
    "languageFallbackName": "Language",
    "languageModalDesc": "Choose the language you want to use across the FEMATA platform.",
    "languageModalTitle": "Select language",
    "languageSearchLabel": "Search languages",
    "languageSearchPlaceholder": "Type a language name...",
    "languageSelected": "Selected",
    "privacyBadge": "Privacy notice",
    "termsBadge": "Terms notice",
    "zoneLabel": "Zone",
    "trackActionStartedLabel": "Action started",
    "trackAdditionalInfoCancel": "Cancel",
    "trackAdditionalInfoEmpty": "No additional information has been added yet.",
    "trackAdditionalInfoLabel": "Add more information for FEMATA",
    "trackAdditionalInfoNoteClose": "Public closure note",
    "trackAdditionalInfoNoteFollowup": "Public follow-up note",
    "trackAdditionalInfoPlaceholder": "Share any new development, correction, or detail that can help this query move forward.",
    "trackAdditionalInfoPromptBody": "If there is a new development, missing context, or a clarification you want FEMATA to see, you can add more information below.",
    "trackAdditionalInfoPromptTitle": "Need to say more?",
    "trackAdditionalInfoSaveError": "Could not save your additional information",
    "trackAdditionalInfoSend": "Send additional information",
    "trackAdditionalInfoSubtitle": "What else you have added",
    "trackAdditionalInfoSuccess": "Your additional information was added successfully.",
    "trackAdditionalInfoTitle": "Additional information",
    "trackAdditionalInfoTooShort": "Please add a little more detail before sending.",
    "trackAgreeAndClose": "Agree and close",
    "trackClosePromptBody": "If you continue, this reference number will be removed from your public dashboard and it will no longer work for public login. FEMATA administrators will still keep the protected institutional record and the history of what happened.",
    "trackClosePromptEyebrow": "Close public reference",
    "trackClosePromptTitle": "Do you want to close this reference for public tracking?",
    "trackCloseReferenceButton": "Close this reference",
    "trackCloseReferenceError": "Could not close this public reference",
    "trackClosingEyebrow": "Closing public query",
    "trackClosingTitle": "Removing this reference from public access",
    "trackClosureBody1": "If this issue has already been resolved, thank you for taking action. You still have the right to share updates with the federation, and every concern is handled with strong confidentiality whether or not you keep using public follow-up.",
    "trackClosureBody2": "If you were worried, wanted to close public tracking, or now have new information, you can still submit a fresh confidential report through the FEMATA secure system. The internal institutional record remains stored safely for administrative review.",
    "trackClosureEyebrow": "Public follow-up closed",
    "trackClosureNewReport": "File a new confidential report",
    "trackClosureTitle": "Thank you for following up",
    "trackDestroyPhrase1": "Removing public login access",
    "trackDestroyPhrase2": "Archiving this reference privately",
    "trackDestroyPhrase3": "Closing public follow-up window",
    "trackGoBack": "Go back",
    "trackGuideActionsBody": "Track progress, read feedback, add more context, or close this public reference if you no longer want it visible on the public side.",
    "trackGuideActionsLabel": "What you can do here",
    "trackGuideConfidentialityBody": "Even if you close this public reference, the internal administrative record remains available only to the protected FEMATA review side.",
    "trackGuideConfidentialityLabel": "Confidentiality note",
    "trackGuideReferenceLabel": "Reference",
    "trackGuideTitle": "Public follow-up guide",
    "trackHideAdditionalInfo": "Hide extra information form",
    "trackKeepOpen": "Keep it open",
    "trackLoadingPhrase1": "Verifying reference integrity",
    "trackLoadingPhrase2": "Opening secure follow-up channel",
    "trackLoadingPhrase3": "Preparing case timeline",
    "trackLookupClosedBody": "This case was closed from the public tracking side, so it can no longer be opened again with the same reference number. FEMATA administrators can still see the protected institutional record.",
    "trackLookupClosedTitle": "This reference is no longer available for public login",
    "trackLookupExpiredBody": "This reference can no longer be viewed from the public tracker. If you still need support or want to continue the matter, please submit a new confidential report.",
    "trackLookupExpiredTitle": "The public follow-up window has expired",
    "trackLookupGenericBody": "The tracker could not load this reference at the moment. Please try again shortly or submit a new confidential report if you still need help.",
    "trackLookupGenericTitle": "We could not open this query right now",
    "trackLookupNotFoundBody": "Please check the number and try again. If you misplaced the correct reference or still need help, you can submit a new confidential query and FEMATA will handle it with discretion.",
    "trackLookupNotFoundTitle": "No query was found with this reference number",
    "trackLookupResultEyebrow": "Reference check result",
    "trackNeedHelpBody1": "If the reference number is wrong, the tracker will not open the query.",
    "trackNeedHelpBody2": "Filing a new confidential report will reopen the protected reporting flow so FEMATA can route the issue to the right regional desk.",
    "trackNeedHelpTitle": "Need help?",
    "trackPublicAccessWindowActive": "Active while this public case space stays open",
    "trackPublicAccessWindowLabel": "Public access window",
    "trackPublicDashboardEyebrow": "Public case dashboard",
    "trackReferenceNumberLabel": "Reference number",
    "trackReferenceRequiredTitle": "Reference number required",
    "trackRefileConfidential": "Re-file a confidential report",
    "trackResponsesEyebrow": "Track responses",
    "trackShowAdditionalInfo": "Add more information",
    "trackTimelineCompleted": "Completed",
    "trackTimelinePending": "Pending",
    "trackTimelineTitle": "Where your query is now",
    "trackTrackedReferencesEmpty": "References you successfully open will appear here for quick access.",
    "trackTrackedReferencesTitle": "Tracked references",
    "trackTryAnotherReference": "Try another reference",
    "trackUseAnotherReference": "Use another reference",
    "trackWorkspaceLoadingEyebrow": "Opening case space",
    "trackWorkspaceLoadingTitle": "Preparing your reference dashboard",
}

COMMON_SYNC_KEYS = [
    "backToHome",
    "chatAssistantDesc",
    "chatAssistantTitle",
    "chatBrandName",
    "chatCapabilitiesTitle",
    "chatCapabilityLanguage",
    "chatCapabilityReporting",
    "chatCapabilitySafety",
    "chatCapabilityTracking",
    "chatDefaultResponse",
    "chatDisclaimerText",
    "chatDisclaimerTitle",
    "chatErrorMessage",
    "chatInputPlaceholder",
    "chatLanguageLabel",
    "chatMessagesLabel",
    "chatModalDesc",
    "chatModalTitle",
    "chatPageDesc",
    "chatPageTitle",
    "chatQuickQuestion1",
    "chatQuickQuestion2",
    "chatQuickQuestion3",
    "chatQuickQuestion4",
    "chatQuickQuestion5",
    "chatQuickQuestionsTitle",
    "chatQuickTipsBody",
    "chatQuickTipsTitle",
    "chatReferenceReminderText",
    "chatReferenceReminderTitle",
    "chatSendButton",
    "chatSending",
    "chatWelcomeMessage",
    "chatWidgetButton",
    "chatWidgetClose",
    "clearChat",
    "documentOpen",
    "documentSectionLabel",
    "documentView",
    "languageCurrentLabel",
    "languageEmptyState",
    "languageFallbackName",
    "languageModalDesc",
    "languageModalTitle",
    "languageSearchLabel",
    "languageSearchPlaceholder",
    "languageSelected",
    "privacyBadge",
    "secureHandoffBadge",
    "secureHandoffCurrentStep",
    "secureHandoffDesc",
    "secureHandoffProgress",
    "secureHandoffStage1",
    "secureHandoffStage2",
    "secureHandoffStage3",
    "secureHandoffTitle",
    "termsBadge",
    "trackActionStartedLabel",
    "trackAdditionalInfoCancel",
    "trackAdditionalInfoEmpty",
    "trackAdditionalInfoLabel",
    "trackAdditionalInfoNoteClose",
    "trackAdditionalInfoNoteFollowup",
    "trackAdditionalInfoPlaceholder",
    "trackAdditionalInfoPromptBody",
    "trackAdditionalInfoPromptTitle",
    "trackAdditionalInfoSaveError",
    "trackAdditionalInfoSend",
    "trackAdditionalInfoSubtitle",
    "trackAdditionalInfoSuccess",
    "trackAdditionalInfoTitle",
    "trackAdditionalInfoTooShort",
    "trackAgreeAndClose",
    "trackClosePromptBody",
    "trackClosePromptEyebrow",
    "trackClosePromptTitle",
    "trackCloseReferenceButton",
    "trackCloseReferenceError",
    "trackClosingEyebrow",
    "trackClosingTitle",
    "trackClosureBody1",
    "trackClosureBody2",
    "trackClosureEyebrow",
    "trackClosureNewReport",
    "trackClosureTitle",
    "trackDestroyPhrase1",
    "trackDestroyPhrase2",
    "trackDestroyPhrase3",
    "trackGoBack",
    "trackGuideActionsBody",
    "trackGuideActionsLabel",
    "trackGuideConfidentialityBody",
    "trackGuideConfidentialityLabel",
    "trackGuideReferenceLabel",
    "trackGuideTitle",
    "trackHideAdditionalInfo",
    "trackKeepOpen",
    "trackLoadingPhrase1",
    "trackLoadingPhrase2",
    "trackLoadingPhrase3",
    "trackLookupClosedBody",
    "trackLookupClosedTitle",
    "trackLookupExpiredBody",
    "trackLookupExpiredTitle",
    "trackLookupGenericBody",
    "trackLookupGenericTitle",
    "trackLookupNotFoundBody",
    "trackLookupNotFoundTitle",
    "trackLookupResultEyebrow",
    "trackNeedHelpBody1",
    "trackNeedHelpBody2",
    "trackNeedHelpTitle",
    "trackPublicAccessWindowActive",
    "trackPublicAccessWindowLabel",
    "trackPublicDashboardEyebrow",
    "trackReferenceNumberLabel",
    "trackReferenceRequiredTitle",
    "trackRefileConfidential",
    "trackResponsesEyebrow",
    "trackShowAdditionalInfo",
    "trackTimelineCompleted",
    "trackTimelinePending",
    "trackTimelineTitle",
    "trackTrackedReferencesEmpty",
    "trackTrackedReferencesTitle",
    "trackTryAnotherReference",
    "trackUseAnotherReference",
    "trackWorkspaceLoadingEyebrow",
    "trackWorkspaceLoadingTitle",
    "zoneLabel",
]

REPORT_SOURCE_UPDATES: dict[str, str] = {
    "reportZoneDerived": "Zone is derived automatically from the selected region.",
}

REPORT_SYNC_KEYS = [
    "reportAnonymousSafeguard1",
    "reportAnonymousSafeguard2",
    "reportAnonymousSafeguard3",
    "reportAnonymousSafeguards",
    "reportCopied",
    "reportCopy",
    "reportHome",
    "reportInitError",
    "reportInitErrorHelp",
    "reportInitLoading",
    "reportPublicLookupRetention",
    "reportReferenceBody",
    "reportReferenceTitle",
    "reportRetention",
    "reportRetry",
    "reportSubmitBadge1",
    "reportSubmitBadge2",
    "reportSubmitBadge3",
    "reportSubmitComplete",
    "reportSubmitLoadingDesc",
    "reportSubmitLoadingTitle",
    "reportSubmitSeal",
    "reportSubmitState1",
    "reportSubmitState2",
    "reportSubmitState3",
    "reportSubmitTransferLabel",
    "reportSubmittedBody",
    "reportSubmittedThanks",
    "reportSubmittedTitle",
    "reportVisibleLaterBody",
    "reportWhatVisibleLater",
    "reportZoneDerived",
    "secureHandoffBadge",
    "secureHandoffCurrentStep",
    "secureHandoffDesc",
    "secureHandoffProgress",
    "secureHandoffStage1",
    "secureHandoffStage2",
    "secureHandoffStage3",
    "secureHandoffTitle",
]

CHUNK_SIZE = 22
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
        "temperature": 0.15,
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
        "You are a professional software localizer. Translate FEMATA UI strings from English into the requested target language. "
        "Return only a valid JSON object with exactly the same keys as the input. Preserve placeholders like {{count}}, {{name}}, "
        "{{num}}, {{region}}, punctuation, arrays, capitalization, and line breaks. Keep product names such as FEMATA unchanged. "
        "Use clear, natural UI language suitable for a public mining safety reporting platform."
    )
    user_prompt = (
        f"Translate this JSON object into {language_name}. Use the native script for the language.\n"
        "Important rules:\n"
        "- Keep the keys exactly the same.\n"
        "- Preserve all placeholders exactly.\n"
        "- Preserve the JSON structure.\n"
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


def translate_map(language_name: str, values: dict[str, object]) -> dict[str, object]:
    if not values:
        return {}

    translated: dict[str, object] = {}
    items = list(values.items())
    total_chunks = max(1, (len(items) + CHUNK_SIZE - 1) // CHUNK_SIZE)

    for chunk_index, group in enumerate(chunk_items(items, CHUNK_SIZE), start=1):
        chunk = {key: value for key, value in group}
        last_error: Exception | None = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                translated_chunk = translate_chunk(language_name, chunk)
                translated.update(translated_chunk)
                print(f"[translate] {language_name}: chunk {chunk_index}/{total_chunks} attempt {attempt}", flush=True)
                break
            except Exception as error:  # noqa: BLE001
                last_error = error
                wait_seconds = attempt * 3
                print(f"[translate] retry {attempt}/{MAX_RETRIES} for {language_name} after error: {error}", flush=True)
                time.sleep(wait_seconds)
        else:
            raise RuntimeError(f"Failed translating {language_name} chunk {chunk_index}/{total_chunks}") from last_error
    return translated


def read_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, object]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def ordered_output(source: dict[str, object], updated: dict[str, object]) -> dict[str, object]:
    merged = dict(updated)
    ordered = {key: merged[key] for key in source.keys() if key in merged}
    for key, value in merged.items():
        if key not in ordered:
            ordered[key] = value
    return ordered


def main() -> int:
    load_local_env_files()

    english_common = read_json(EN_COMMON_PATH)
    english_report = read_json(EN_REPORT_PATH)
    english_common.update(COMMON_SOURCE_UPDATES)
    english_report.update(REPORT_SOURCE_UPDATES)
    write_json(EN_COMMON_PATH, ordered_output(english_common, english_common))
    write_json(EN_REPORT_PATH, ordered_output(english_report, english_report))

    for code, language_name in TARGET_LANGUAGES.items():
        common_path = LOCALES_DIR / code / "common.json"
        report_path = LOCALES_DIR / code / "report.json"
        common_payload = read_json(common_path)
        report_payload = read_json(report_path)

        common_to_translate = {
            key: english_common[key]
            for key in COMMON_SYNC_KEYS
            if key in english_common and (key not in common_payload or common_payload.get(key) == english_common[key])
        }
        common_translated = translate_map(language_name, common_to_translate)
        common_payload.update(common_translated)
        write_json(common_path, ordered_output(common_payload, common_payload))

        common_after = read_json(common_path)
        report_direct = {}
        report_to_translate = {}
        for key in REPORT_SYNC_KEYS:
            if key not in english_report:
                continue
            english_value = english_report[key]
            current_value = report_payload.get(key)
            common_value = common_after.get(key)

            if common_value not in (None, english_value):
                report_direct[key] = common_value
                continue

            if current_value is None or current_value == english_value:
                report_to_translate[key] = english_value

        report_payload.update(report_direct)
        report_translated = translate_map(language_name, report_to_translate)
        report_payload.update(report_translated)
        write_json(report_path, ordered_output(report_payload, report_payload))

        print(
            f"[done] {code}: common={len(common_to_translate)} report_direct={len(report_direct)} report_translated={len(report_to_translate)}",
            flush=True,
        )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        raise SystemExit(130)
