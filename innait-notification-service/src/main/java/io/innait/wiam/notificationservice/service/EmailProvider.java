package io.innait.wiam.notificationservice.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.Map;

@Service
public class EmailProvider {

    private static final Logger log = LoggerFactory.getLogger(EmailProvider.class);

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;

    @Value("${innait.notification.email.from:noreply@innait.io}")
    private String defaultFrom;

    public EmailProvider(JavaMailSender mailSender, TemplateEngine templateEngine) {
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
    }

    /**
     * Send an email with rendered subject and body (plain text).
     */
    public void send(String to, String subject, String body) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(defaultFrom);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body, false);
            mailSender.send(message);
            log.info("Email sent to [{}] subject [{}]", to, subject);
        } catch (MessagingException e) {
            log.error("Failed to send email to [{}]: {}", to, e.getMessage(), e);
            throw new RuntimeException("Email sending failed", e);
        }
    }

    /**
     * Send an HTML email using a Thymeleaf template.
     */
    public void sendHtml(String to, String subject, String thymeleafTemplate,
                         Map<String, String> variables) {
        try {
            Context context = new Context();
            variables.forEach(context::setVariable);

            String htmlBody = templateEngine.process(thymeleafTemplate, context);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(defaultFrom);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(message);
            log.info("HTML email sent to [{}] subject [{}]", to, subject);
        } catch (MessagingException e) {
            log.error("Failed to send HTML email to [{}]: {}", to, e.getMessage(), e);
            throw new RuntimeException("HTML email sending failed", e);
        }
    }

    /**
     * Send email with both plain text and HTML body.
     */
    public void sendWithFallback(String to, String subject, String plainBody, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(defaultFrom);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(plainBody, htmlBody);
            mailSender.send(message);
            log.info("Email (multipart) sent to [{}]", to);
        } catch (MessagingException e) {
            log.error("Failed to send multipart email to [{}]: {}", to, e.getMessage(), e);
            throw new RuntimeException("Email sending failed", e);
        }
    }
}
