package io.innait.wiam.adminconfigservice.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.naming.NamingEnumeration;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import java.util.Hashtable;

/**
 * Verifies domain ownership via DNS TXT record lookup.
 * Expected TXT record: innait-verify=<verification_token>
 */
@Service
public class DnsVerificationService {

    private static final Logger log = LoggerFactory.getLogger(DnsVerificationService.class);

    public boolean verifyDomain(String domainName, String expectedToken) {
        try {
            Hashtable<String, String> env = new Hashtable<>();
            env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");

            DirContext ctx = new InitialDirContext(env);
            Attributes attrs = ctx.getAttributes(domainName, new String[]{"TXT"});
            ctx.close();

            var txtRecords = attrs.get("TXT");
            if (txtRecords == null) return false;

            NamingEnumeration<?> values = txtRecords.getAll();
            while (values.hasMore()) {
                String record = values.next().toString().replace("\"", "");
                if (record.equals("innait-verify=" + expectedToken)) {
                    log.info("Domain [{}] verified successfully", domainName);
                    return true;
                }
            }

            log.info("Domain [{}] TXT record mismatch", domainName);
            return false;
        } catch (Exception e) {
            log.warn("DNS lookup failed for domain [{}]: {}", domainName, e.getMessage());
            return false;
        }
    }
}
