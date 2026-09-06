# AC: Commercial и разделение контуров

Часть [canonical spec](../project-spec.md). Единственный владелец формулировок AC этой подсистемы. Статусы/Evidence находятся в [реестре](../delivery/commercial.md).

### Эпик `ENVIRONMENT-CAPABILITIES-01` — единый codebase и изолированные contours

| AC | Проверяемое требование |
|---|---|
| `EVC-01` | Personal и commercial используют единый основной codebase. |
| `EVC-02` | Personal и commercial используют единый `main`. |
| `EVC-03` | Commercial не поддерживается как постоянно расходящаяся branch. |
| `EVC-04` | Personal и commercial разворачиваются как отдельные environments. |
| `EVC-05` | Personal и commercial имеют отдельные configs. |
| `EVC-06` | Personal и commercial имеют отдельные secrets. |
| `EVC-07` | Personal и commercial имеют отдельные databases. |
| `EVC-08` | Personal и commercial имеют отдельные S3 resources. |
| `EVC-09` | Personal и commercial имеют отдельные API keys. |
| `EVC-10` | Personal и commercial имеют отдельные OAuth credentials. |
| `EVC-11` | Personal и commercial имеют отдельные domains. |
| `EVC-12` | Остальные environment-specific settings разделены по contour. |
| `EVC-13` | Personal включает все approved commercial capabilities. |
| `EVC-14` | Personal может включать дополнительные foreign/experimental/admin capabilities. |
| `EVC-15` | Commercial изолирован инфраструктурно, а не только frontend visibility. |
| `EVC-16` | Credentials неиспользуемого commercial provider отсутствуют в commercial environment. |
| `EVC-17` | Contour differences задаются configuration. |
| `EVC-18` | Contour differences задаются capability model. |
| `EVC-19` | Contour differences задаются bounded feature flags. |
| `EVC-20` | Contour differences задаются подключаемыми modules/providers. |
| `EVC-21` | Contour differences не размазаны множеством ad-hoc conditionals. |
| `EVC-22` | Personal и commercial деплоятся независимо. |
| `EVC-23` | Personal UI имеет режим `только commercial capabilities`. |
| `EVC-24` | Personal UI имеет режим `только personal-only capabilities`. |
| `EVC-25` | Personal UI имеет режим `все capabilities`. |
| `EVC-26` | Personal UI capability mode не меняет backend. |
| `EVC-27` | Personal UI capability mode не меняет environment. |
| `EVC-28` | Personal UI capability mode не меняет database. |
| `EVC-29` | Personal UI capability mode не меняет S3/storage. |
| `EVC-30` | Personal UI capability mode не меняет STT credentials. |
| `EVC-31` | Commercial-view mode в personal воспроизводит approved commercial UX/UI. |
| `EVC-32` | Personal и commercial имеют независимый rollback. |
| `EVC-33` | STT provider заменяется через bounded interface. |
| `EVC-34` | S3/storage provider заменяется через bounded interface. |
| `EVC-35` | Authorization provider заменяется через bounded interface. |
| `EVC-36` | Notification provider заменяется через bounded interface. |
| `EVC-37` | Core entities поддерживают `user_id`/`tenant_id` ownership. |
| `EVC-38` | Personal admin auth не блокирует future user roles/access control. |
| `EVC-39` | STT provider implementations являются отдельными modules. |
| `EVC-40` | Storage implementations являются отдельными modules. |
| `EVC-41` | Authorization implementations являются отдельными modules. |
| `EVC-42` | Notification implementations являются отдельными modules. |
| `EVC-43` | Другие external integrations являются capability-scoped modules. |
| `EVC-44` | Audio processing boundary заменяема независимо. |
| `EVC-45` | Transcription boundary заменяема независимо. |
| `EVC-46` | Google Drive boundary заменяема независимо. |
| `EVC-47` | File-storage boundary заменяема независимо. |
| `EVC-48` | Document-creation boundary заменяема независимо. |
| `EVC-49` | Unused integration code не делает capability доступной в commercial. |
| `EVC-50` | Российские и иностранные providers используют общий interface, когда capabilities совместимы. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-INFRA-DATA-01` — infrastructure и localization

| AC | Проверяемое требование |
|---|---|
| `CINF-01` | Основной commercial production backend размещается на российской инфраструктуре, пригодной для обработки данных российских пользователей. |
| `CINF-02` | Основная PostgreSQL database размещается на территории РФ. |
| `CINF-03` | Commercial S3 использует S3-compatible storage российского provider вместо Cloudflare R2. |
| `CINF-04` | PostgreSQL backups соблюдают localization requirements. |
| `CINF-05` | Backups пользовательских данных соблюдают localization requirements. |
| `CINF-06` | Temporary FFmpeg files хранятся на российской инфраструктуре. |
| `CINF-07` | Intermediate processing results хранятся на российской инфраструктуре. |
| `CINF-08` | Logs, analytics и diagnostics не отправляют персональные данные в зарубежные services без контроля. |
| `CINF-09` | Cloudflare и другие foreign infrastructure services проверяются по фактическому data flow. |
| `CINF-10` | **ALIAS, вне denominator → EVC-07.** Сохранённая формулировка: Commercial использует отдельный PostgreSQL. |
| `CINF-11` | **ALIAS, вне denominator → EVC-08.** Сохранённая формулировка: Commercial использует отдельное S3 storage. |
| `CINF-12` | **ALIAS, вне denominator → EVC-06.** Сохранённая формулировка: Commercial использует отдельные secrets. |
| `CINF-13` | **ALIAS, вне denominator → EVC-09.** Сохранённая формулировка: Commercial использует отдельные API keys. |
| `CINF-14` | **ALIAS, вне denominator → EVC-10.** Сохранённая формулировка: Commercial использует отдельные OAuth credentials. |
| `CINF-15` | Остальные production resources commercial изолированы от personal. |
| `CINF-16` | Для PostgreSQL утверждён RPO. |
| `CINF-17` | Для PostgreSQL утверждён RTO. |
| `CINF-18` | Point-in-time restore реализован и проверен. |
| `CINF-19` | Реальное восстановление данных из backup регулярно проверяется. |
| `CINF-20` | Удалённые пользователем данные не возвращаются в production после restore старого backup. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-IDENTITY-01` — registration, auth и TOTP

| AC | Проверяемое требование |
|---|---|
| `CID-01` | Основной способ registration/auth пользователей — email + password. |
| `CID-02` | Registration допускает Gmail и другие foreign email addresses. |
| `CID-03` | Foreign email не интерпретируется как Google OAuth login. |
| `CID-04` | После registration email подтверждается. |
| `CID-05` | Password reset использует one-time token. |
| `CID-06` | Password reset token имеет ограниченный lifetime. |
| `CID-07` | Password reset не раскрывает existence account и fail-closed обрабатывает повтор. |
| `CID-08` | System emails отправляет transactional email provider. |
| `CID-09` | Transactional email использует собственный domain. |
| `CID-10` | Google OAuth не используется для registration/auth в российском commercial production. |
| `CID-11` | Yandex ID доступен как optional OAuth provider. |
| `CID-12` | VK ID доступен как optional OAuth provider. |
| `CID-13` | Google OAuth не предоставляется как commercial login; Google Drive является personal integration, commercial использует Яндекс Диск. |
| `CID-14` | Любое будущее включение Google Drive в commercial требует отдельного explicit product decision и applicable legal gate; наличие personal OAuth кода не включает его автоматически. |
| `CID-15` | Доступна optional TOTP 2FA. |
| `CID-16` | TOTP совместим с разными standard authenticator apps. |
| `CID-17` | Определён безопасный account recovery. |
| `CID-18` | Определён безопасный second-factor reset. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-DATA-GOVERNANCE-01` — персональные данные

| AC | Проверяемое требование |
|---|---|
| `CDG-01` | Первичная запись персональных данных выполняется в РФ. |
| `CDG-02` | Систематизация персональных данных выполняется в РФ. |
| `CDG-03` | Накопление персональных данных выполняется в РФ. |
| `CDG-04` | Хранение персональных данных выполняется в РФ. |
| `CDG-05` | Изменение персональных данных выполняется в РФ. |
| `CDG-06` | Извлечение персональных данных выполняется в РФ. |
| `CDG-07` | Определён полный перечень персональных данных сервиса. |
| `CDG-08` | Определены data rules для audio recordings. |
| `CDG-09` | Определены data rules для transcripts. |
| `CDG-10` | Определены data rules для speaker voices. |
| `CDG-11` | Определены data rules для email. |
| `CDG-12` | Определены data rules для IP addresses. |
| `CDG-13` | Определены data rules для OAuth tokens. |
| `CDG-14` | Определены data rules для diagnostic data. |
| `CDG-15` | Для каждого data type определена processing purpose. |
| `CDG-16` | Для каждого data type определено legal basis. |
| `CDG-17` | Для каждого data type определён retention period. |
| `CDG-18` | Данные удаляются после истечения retention period. |
| `CDG-19` | Данные удаляются по подтверждённому user request. |
| `CDG-20` | Пользователь может удалить account. |
| `CDG-21` | Account deletion очищает связанные user data. |
| `CDG-22` | Account deletion очищает сохранённые OAuth tokens. |
| `CDG-23` | Подготовлена policy обработки персональных данных. |
| `CDG-24` | Подготовлено user agreement и/или public offer. |
| `CDG-25` | Подготовлены необходимые consents на обработку персональных данных. |
| `CDG-26` | Проверена необходимость уведомления Роскомнадзора как operator персональных данных. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-CROSS-BORDER-01` — foreign services и legal gates

| AC | Проверяемое требование |
|---|---|
| `CXB-01` | Для каждого foreign service определён передаваемый набор user data. |
| `CXB-02` | Foreign STT provider проверен по законодательству РФ. |
| `CXB-03` | Foreign STT provider проверен по своим terms of use. |
| `CXB-04` | Cross-border data transfer foreign STT provider отдельно проверен. |
| `CXB-05` | Российский STT provider является полноценным production вариантом. |
| `CXB-06` | Commercial production не зависит от ElevenLabs или другого foreign STT provider. |
| `CXB-07` | ElevenLabs может быть включён только как additional provider. |
| `CXB-08` | Использование ElevenLabs в commercial разрешено отдельным legal opinion. |
| `CXB-09` | Техническая возможность foreign provider не считается legal permission для commercial. |
| `CXB-10` | Production не зависит полностью от одного foreign AI provider. |
| `CXB-11` | STT architecture позволяет отключить/заменить provider без переделки всей системы. |
| `CXB-12` | Google Drive является external user integration. |
| `CXB-13` | Google Drive не является primary internal storage сервиса. |
| `CXB-14` | Google Drive OAuth отделён от OAuth login в сам сервис. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-STT-QUOTA-01` — provider tariffs, quotas и dispatch

| AC | Проверяемое требование |
|---|---|
| `CSQ-01` | Для каждого STT provider хранится applicable tariff. |
| `CSQ-02` | Для каждого STT provider хранится transcription cost. |
| `CSQ-03` | Для каждой job учитываются фактически использованные minutes/hours. |
| `CSQ-04` | Пользователи имеют monthly quotas. |
| `CSQ-05` | User quota проверяется до job. |
| `CSQ-06` | Global quota проверяется до job. |
| `CSQ-07` | Expected job spend резервируется на время выполнения. |
| `CSQ-08` | Parallel jobs не могут потратить один и тот же quota balance. |
| `CSQ-09` | Global API spend limits предотвращают accidental/malicious balance exhaustion. |
| `CSQ-10` | Пользователь выбирает понятный режим по price/capabilities. |
| `CSQ-11` | Конкретный STT provider скрыт из обычного commercial UX. |
| `CSQ-12` | Отдельный STT provider можно аварийно отключить. |
| `CSQ-13` | При provider outage связанный mode временно блокируется. |
| `CSQ-14` | Job не переключается автоматически на другой provider. |
| `CSQ-15` | BYOK доступен только при technical compatibility provider. |
| `CSQ-16` | BYOK доступен только после legal permission provider. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-SPEAKER-PRIVACY-01` — diarization без biometrics

| AC | Проверяемое требование |
|---|---|
| `CSP-01` | Commercial показывает обычные diarization labels `Speaker 1`, `Speaker 2`. |
| `CSP-02` | Commercial не выполняет automatic voice-reference/voiceprint identification. |
| `CSP-03` | Voice identification не добавляется до отдельной legal проработки biometric personal data. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-QUEUE-FAIRNESS-01` — fair resource allocation

| AC | Проверяемое требование |
|---|---|
| `CQF-01` | Ограничены concurrently running jobs пользователя/тарифа. |
| `CQF-02` | Ограничены queued jobs пользователя/тарифа. |
| `CQF-03` | Ограничены concurrently running jobs всей системы. |
| `CQF-04` | Ограничены queued jobs всей системы. |
| `CQF-05` | Один пользователь не может занять всю queue. |
| `CQF-06` | Один пользователь не может занять все worker resources. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-BILLING-01` — payments, subscriptions и fiscalization

| AC | Проверяемое требование |
|---|---|
| `CBI-01` | Определена legal form коммерческой деятельности, например ИП. |
| `CBI-02` | Выбран российский payment provider. |
| `CBI-03` | Payment provider поддерживает recurring payments. |
| `CBI-04` | Payments fiscalized. |
| `CBI-05` | Пользователю отправляется receipt. |
| `CBI-06` | Определены tariffs. |
| `CBI-07` | Реализованы subscriptions. |
| `CBI-08` | Реализованы quota по tariffs. |
| `CBI-09` | Реализована purchase дополнительных hours. |
| `CBI-10` | Ведётся internal payment accounting. |
| `CBI-11` | Ведётся internal accounting оказанных услуг. |
| `CBI-12` | Billing/usage accounting отделён от ordinary analytics. |
| `CBI-13` | Очистка ordinary analytics не удаляет billing/usage accounting. |
| `CBI-14` | Job хранит immutable tariff snapshot. |
| `CBI-15` | Job хранит immutable mode snapshot. |
| `CBI-16` | Job хранит immutable calculation-rules snapshot. |
| `CBI-17` | Payment/subscription state восстанавливается после missed webhook. |
| `CBI-18` | Repeated webhook обрабатывается idempotently. |
| `CBI-19` | Repeated provider event не создаёт double charge. |
| `CBI-20` | Repeated provider event не начисляет quota дважды. |
| `CBI-21` | Repeated provider event не продлевает subscription дважды. |
| `CBI-22` | Subscription cancellation обрабатывается корректно. |
| `CBI-23` | Payment refund обрабатывается корректно. |
| `CBI-24` | Failed recurring charge обрабатывается корректно. |
| `CBI-25` | Admin видит tariffs. |
| `CBI-26` | Admin видит payments. |
| `CBI-27` | Admin видит API spend. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-ECONOMICS-01` — unit economics

| AC | Проверяемое требование |
|---|---|
| `CEC-01` | Для каждой job собирается STT cost. |
| `CEC-02` | Собирается storage cost. |
| `CEC-03` | Собирается compute cost. |
| `CEC-04` | Собирается network traffic cost. |
| `CEC-05` | Учитывается payment-provider commission. |
| `CEC-06` | Учитывается fiscalization cost. |
| `CEC-07` | Учитываются taxes. |
| `CEC-08` | Учитываются другие mandatory business expenses. |
| `CEC-09` | Рассчитывается cost per transcription hour для каждого provider/mode. |
| `CEC-10` | Рассчитывается average cost одного active user. |
| `CEC-11` | Рассчитывается ARPU. |
| `CEC-12` | Рассчитывается contribution margin. |
| `CEC-13` | Рассчитывается retention. |
| `CEC-14` | Рассчитывается LTV. |
| `CEC-15` | До advertising launch определён maximum allowed acquisition cost. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-SECURITY-01` — least privilege, tenancy и backups

| AC | Проверяемое требование |
|---|---|
| `CSEC-01` | Все STT provider API keys хранятся только на backend. |
| `CSEC-02` | API keys шифруются at rest. |
| `CSEC-03` | OAuth refresh tokens шифруются at rest. |
| `CSEC-04` | Другие application secrets шифруются at rest. |
| `CSEC-05` | Encryption keys хранятся отдельно от primary database. |
| `CSEC-06` | Database не доступна напрямую из internet. |
| `CSEC-07` | Production app не подключается к database как superuser. |
| `CSEC-08` | Все user data разделены по `user_id` или `tenant_id`. |
| `CSEC-09` | File access проверяется по current user/tenant. |
| `CSEC-10` | Job access проверяется по current user/tenant. |
| `CSEC-11` | Transcription access проверяется по current user/tenant. |
| `CSEC-12` | Integration access проверяется по current user/tenant. |
| `CSEC-13` | Основные user-owned tables используют PostgreSQL RLS как дополнительную isolation layer. |
| `CSEC-14` | Critical actions записываются в audit log. |
| `CSEC-15` | User/API rate limits включены. |
| `CSEC-16` | **ALIAS, вне denominator → CQF-01, CQF-03.** Сохранённая формулировка: Concurrent running jobs ограничены. |
| `CSEC-17` | Media/FFmpeg workers отделены от API. |
| `CSEC-18` | Media/FFmpeg workers имеют minimum required privileges. |
| `CSEC-19` | Database backup выполняется регулярно. |
| `CSEC-20` | **ALIAS, вне denominator → CINF-19.** Сохранённая формулировка: Database restore регулярно проверяется. |
| `CSEC-21` | Credentials personal и commercial production никогда не переиспользуются между contours. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-NOTIFICATIONS-01` — replaceable notification providers

| AC | Проверяемое требование |
|---|---|
| `CNOT-01` | Для transactional email выбран российский provider. |
| `CNOT-02` | Для system notifications выбран российский provider. |
| `CNOT-03` | Для external notification services определён передаваемый набор personal data. |
| `CNOT-04` | Web Push реализован отдельным module. |
| `CNOT-05` | Email реализован отдельным module. |
| `CNOT-06` | Messenger notifications реализованы отдельным module. |
| `CNOT-07` | Notification provider можно заменить. |
| `CNOT-08` | Notification provider можно отключить. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-LEGAL-01` — launch legal readiness

| AC | Проверяемое требование |
|---|---|
| `CLEG-01` | До public commercial launch проведена legal review фактического user-data flow. |
| `CLEG-02` | Personal-data policy соответствует фактическому backend behavior. |
| `CLEG-03` | Cross-border transfer через Google Drive проверен отдельно. |
| `CLEG-04` | Cross-border transfer для каждого foreign STT provider проверен отдельно. |
| `CLEG-05` | Допустимость ElevenLabs проверена отдельно. |
| `CLEG-06` | Допустимость каждой другой foreign integration проверена отдельно. |
| `CLEG-07` | **ALIAS, вне denominator → CDG-24.** Сохранённая формулировка: Подготовлено user agreement/public offer. |
| `CLEG-08` | **ALIAS, вне denominator → CDG-23.** Сохранённая формулировка: Подготовлена personal-data processing policy. |
| `CLEG-09` | **ALIAS, вне denominator → CDG-25.** Сохранённая формулировка: Подготовлены необходимые consents. |
| `CLEG-10` | Определён retention audio recordings. |
| `CLEG-11` | Определено deletion audio recordings. |
| `CLEG-12` | Определён retention transcripts. |
| `CLEG-13` | Определено deletion transcripts. |
| `CLEG-14` | Пользователь подтверждает право загружать и обрабатывать передаваемые audio recordings. |
| `CLEG-15` | Пользователь может отозвать consents. |
| `CLEG-16` | Пользователь может отключить external integrations. |
| `CLEG-17` | При отключении integration связанные tokens удаляются. |
| `CLEG-18` | Перед production launch актуальные legal requirements проверяются повторно. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.

### Эпик `COMMERCIAL-COMPLETENESS-02` — Дополнение commercial и personal preview

| AC | Проверяемое требование |
|---|---|
| `CX-01` | Commercial-набор personal воспроизводит тарифные ограничения и соответствующие состояния UI. Основание: S012. |
| `CX-02` | Проверка commercial-набора владельцем personal не требует реальной покупки подписки. Основание: S013. |
| `CX-03` | Пользователь commercial может запретить последующие списания и использование сохранённых платёжных реквизитов. Основание: S206. |
| `CX-04` | Для cancellation, partial, failure и retry определены и показаны правила расхода квоты. Основание: S209. |
| `CX-05` | Admin видит подписки и возвраты со связанным расходом. Основание: S210. |
| `CX-06` | Правила обработки записей и текста действуют независимо от отказа от идентификации спикеров. Основание: S213. |
| `CX-07` | Account deletion объясняет сохранение обязательных учётных записей. Основание: S216. |
| `CX-08` | Отдельно требуемые согласия не объединяются скрыто с офертой. Основание: S217. |
| `CX-09` | LTV estimate отличается от фактических исторических данных; доступна выручка. Основание: S242. |

Проверка AC этого эпика: Изолированный commercial target; positive/negative tenancy, permissions, quotas и recovery; документы/решения проверяются по принятому содержимому и фактическому data flow. Конкретные существующие suites и незакрытые gaps — в [delivery dashboard](../delivery-plan.md). Наличие suite не подтверждает её полноту.
