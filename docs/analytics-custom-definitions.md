# GA4 Custom Definitions

Create these before shipping the next build. Firebase/GA4 will collect the event parameters, but GA4 reports, Explorations, audiences, and Data API queries need the matching custom definitions registered.

References:
- Firebase event logging and custom parameter registration: https://firebase.google.com/docs/analytics/ios/events
- GA4 event naming and reserved names: https://support.google.com/analytics/answer/13316687?hl=en
- GA4 custom dimension/metric API names: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema#custom_dimensions
- GA4 configuration limits: https://support.google.com/analytics/answer/12229528?hl=en

## Event-Scoped Custom Dimensions

Create all 50 as event-scoped custom dimensions:

| Display name | Event parameter |
| --- | --- |
| Screen | `screen` |
| Previous screen | `previous_screen` |
| Origin | `origin` |
| UI element | `ui_element` |
| UI action | `ui_action` |
| Flow | `flow` |
| Status | `status` |
| Result | `result` |
| Reason | `reason` |
| Source | `source` |
| Method | `method` |
| Modal | `modal` |
| App state | `app_state` |
| Device locale | `device_locale` |
| Native language | `native_lang` |
| Learning language | `learning_lang` |
| Helper language | `helper_lang` |
| Favourite language | `favorite_lang` |
| Language target | `language_target` |
| Previous language | `previous_lang` |
| Next language | `next_lang` |
| Category | `category` |
| Phrase ID | `phrase_id` |
| Phrase category | `phrase_category` |
| Phrase type | `phrase_type` |
| Phrase source | `phrase_source` |
| Phrase tags | `phrase_tags` |
| Is custom | `is_custom` |
| Is favourite | `is_favorite` |
| Is toxic | `is_toxic` |
| Has safer alternative | `has_safer_alt` |
| Practice mode | `practice_mode` |
| Attempt result | `attempt_result` |
| Feedback label | `feedback_label` |
| Permission status | `permission_status` |
| Recognition state | `recognition_state` |
| Prompt type | `prompt_type` |
| Playback rate | `playback_rate` |
| Audio source | `audio_source` |
| TTS engine | `tts_engine` |
| Auto listen | `auto_listen` |
| Search context | `search_context` |
| Has query | `has_query` |
| Ad placement | `ad_placement` |
| Ad format | `ad_format` |
| Ad result | `ad_result` |
| Ad gate reason | `ad_gate_reason` |
| Remote Config key | `remote_config_key` |
| Error code | `error_code` |
| Error name | `error_name` |

## Event-Scoped Custom Metrics

Create these 23 as event-scoped custom metrics. Use the default unit unless GA4 asks for a unit; use milliseconds for `*_ms` fields.

| Display name | Event parameter |
| --- | --- |
| Elapsed ms | `elapsed_ms` |
| Duration ms | `duration_ms` |
| Query length | `query_length` |
| Result count | `result_count` |
| Phrase count | `phrase_count` |
| Favourite count | `favorite_count` |
| Custom phrase count | `custom_phrase_count` |
| Available count | `available_count` |
| Item index | `item_index` |
| Total count | `total_count` |
| Attempt score | `attempt_score` |
| Expected token count | `expected_token_count` |
| Spoken token count | `spoken_token_count` |
| Progress percent | `progress_pct` |
| Ad frequency | `ad_frequency` |
| Policy version | `policy_version` |
| Input length | `input_length` |
| Translated length | `translated_length` |
| Successful count | `successful_count` |
| Skipped count | `skipped_count` |
| Error count | `error_count` |
| Grace remaining ms | `grace_remaining_ms` |
| First launch used ms | `first_launch_used_ms` |

## User-Scoped Custom Dimensions

Create these 13 as user-scoped custom dimensions from user properties:

| Display name | User property |
| --- | --- |
| User ads enabled | `user_ads_enabled` |
| User ads policy version | `user_ads_policy_version` |
| User banner enabled | `user_banner_enabled` |
| User custom count bucket | `user_custom_count_bucket` |
| User favourite count bucket | `user_favorite_count_bucket` |
| User favourite language | `user_favorite_lang` |
| User has custom phrases | `user_has_custom_phrases` |
| User has favourites | `user_has_favorites` |
| User interstitial enabled | `user_interstitial_enabled` |
| User learning language | `user_learning_lang` |
| User native language | `user_native_lang` |
| User platform | `user_platform` |
| User toxic acknowledgement | `user_toxic_ack` |

