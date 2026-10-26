package vn.bdhvs.common.mail;

import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import vn.bdhvs.common.config.AppProperties;

/** Gửi email bất đồng bộ, thử lại tối đa 3 lần (NFR-REL-06). Không ghi log nội dung OTP (NFR-SEC-06). */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender sender;
    private final AppProperties props;

    public MailService(JavaMailSender sender, AppProperties props) {
        this.sender = sender;
        this.props = props;
    }

    @Async
    public void sendOtp(String to, String fullName, String code, String purpose) {
        String subject = "REGISTER".equals(purpose)
                ? "[Bình Dân Học Vụ Số] Mã xác thực đăng ký tài khoản"
                : "[Bình Dân Học Vụ Số] Mã xác thực đặt lại mật khẩu";
        String body = """
                <p>Xin chào %s,</p>
                <p>Mã xác thực của bạn là:</p>
                <p style="font-size:28px;font-weight:800;letter-spacing:6px;color:#962521">%s</p>
                <p>Mã có hiệu lực trong 5 phút. Không chia sẻ mã này cho bất kỳ ai.</p>
                <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
                """.formatted(HtmlUtils.htmlEscape(fullName), code);
        send(to, subject, body);
    }

    @Async
    public void sendPasswordChanged(String to, String fullName) {
        send(to, "[Bình Dân Học Vụ Số] Mật khẩu của bạn vừa được thay đổi", """
                <p>Xin chào %s,</p>
                <p>Mật khẩu tài khoản của bạn vừa được thay đổi. Nếu không phải bạn thực hiện, hãy liên hệ quản trị viên ngay.</p>
                """.formatted(HtmlUtils.htmlEscape(fullName)));
    }

    @Async
    public void sendSetPasswordLink(String to, String fullName, String link) {
        send(to, "[Bình Dân Học Vụ Số] Đặt mật khẩu cho tài khoản của bạn", """
                <p>Xin chào %s,</p>
                <p>Quản trị viên đã tạo hoặc yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                <p><a href="%s">Bấm vào đây để đặt mật khẩu</a> (liên kết có hiệu lực trong 24 giờ).</p>
                """.formatted(HtmlUtils.htmlEscape(fullName), HtmlUtils.htmlEscape(link)));
    }

    /** FR-LRN-13: nhắc hạn học. */
    @Async
    public void sendDeadlineReminder(String to, String fullName, String courseTitle, int progress, String deadline,
            String link) {
        send(to, "[Bình Dân Học Vụ Số] Sắp hết thời hạn học: " + courseTitle, """
                <p>Xin chào %s,</p>
                <p>Khóa học <b>%s</b> sẽ hết thời hạn học vào <b>%s</b>. Tiến độ hiện tại của bạn: <b>%d%%</b>.</p>
                <p>Hết hạn mà chưa hoàn thành, dữ liệu học tập sẽ bị xóa và bạn phải học lại từ đầu.</p>
                <p><a href="%s">Tiếp tục học</a></p>
                """.formatted(HtmlUtils.htmlEscape(fullName), HtmlUtils.htmlEscape(courseTitle),
                deadline, progress, HtmlUtils.htmlEscape(link)));
    }

    private void send(String to, String subject, String html) {
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                MimeMessage msg = sender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(msg, false, StandardCharsets.UTF_8.name());
                helper.setFrom(InternetAddress.parse(props.mailFrom())[0]);
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(wrap(html), true);
                sender.send(msg);
                return;
            } catch (Exception e) {
                log.warn("Gửi email thất bại lần {} tới {}: {}", attempt, to, e.getMessage());
                try {
                    Thread.sleep(1000L * attempt);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
        }
        log.error("Không gửi được email tới {} sau 3 lần thử", to);
    }

    private static String wrap(String inner) {
        return """
                <div style="font-family:Arial,sans-serif;font-size:15px;color:#1f1a1a;max-width:560px">
                <div style="background:#962521;color:#fff;padding:14px 18px;font-weight:700">Bình Dân Học Vụ Số — Trường ĐHSP Hà Nội 2</div>
                <div style="padding:18px;border:1px solid #f1dad8;border-top:0">%s</div></div>
                """.formatted(inner);
    }
}
