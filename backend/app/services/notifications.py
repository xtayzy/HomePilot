"""Уведомления: отправка писем (регистрация, подтверждение email и т.п.)."""

from email.message import EmailMessage
import smtplib

from app.config import get_settings


def _send_email(to_email: str, subject: str, body: str, *, code: str | None = None) -> None:
    """Простая отправка письма через SMTP.

    Если SMTP не настроен (development), выводит письмо в stdout (видно в docker logs и в консоли).
    """
    settings = get_settings()
    if not settings.SMTP_HOST or not settings.EMAIL_FROM:
        # Вывод в stdout с flush, чтобы гарантированно видеть в docker compose logs -f backend
        print("=== EMAIL (SMTP не настроен) ===", flush=True)
        print("To:", to_email, flush=True)
        print("Subject:", subject, flush=True)
        print("Body:\n", body, flush=True)
        if code:
            print(">>> КОД ПОДТВЕРЖДЕНИЯ (введите на странице подтверждения):", flush=True)
            print(f">>> {code}", flush=True)
        print("=== END EMAIL ===", flush=True)
        return

    msg = EmailMessage()
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


def send_registration_confirm_email(to_email: str, code: str, locale: str = "ru") -> None:
    """Отправка письма с 6-значным кодом подтверждения email при регистрации клиента."""
    if locale == "kk":
        subject = "HomePilot: Электрондық поштаны растаңыз"
        body = (
            "Сәлеметсіз бе!\n\n"
            "HomePilot сервисінде тіркелуіңізге рахмет.\n"
            f"Тіркеуді аяқтау үшін төмендегі 6 таңбалы коды енгізіңіз: {code}\n\n"
            "Егер сіз бұл әрекетті бастамаған болсаңыз, бұл хатты елемеуге болады.\n"
        )
    else:
        subject = "HomePilot: Подтверждение email"
        body = (
            "Здравствуйте!\n\n"
            "Спасибо за регистрацию в HomePilot.\n"
            f"Чтобы завершить регистрацию, введите этот 6-значный код на странице подтверждения: {code}\n\n"
            "Если вы не регистрировались в HomePilot, просто проигнорируйте это письмо.\n"
        )

    _send_email(to_email, subject, body, code=code)

