package io.innait.wiam.apigateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Component("innaITGatewayProperties")
@ConfigurationProperties(prefix = "innait.gateway")
public class GatewayProperties {

    private Jwt jwt = new Jwt();
    private RateLimit rateLimit = new RateLimit();
    private List<String> publicPaths = List.of();

    public Jwt getJwt() { return jwt; }
    public void setJwt(Jwt jwt) { this.jwt = jwt; }
    public RateLimit getRateLimit() { return rateLimit; }
    public void setRateLimit(RateLimit rateLimit) { this.rateLimit = rateLimit; }
    public List<String> getPublicPaths() { return publicPaths; }
    public void setPublicPaths(List<String> publicPaths) { this.publicPaths = publicPaths; }

    public static class Jwt {
        private String jwksUrl = "http://localhost:8086/.well-known/jwks.json";
        private String issuer = "https://auth.innait.io";

        public String getJwksUrl() { return jwksUrl; }
        public void setJwksUrl(String jwksUrl) { this.jwksUrl = jwksUrl; }
        public String getIssuer() { return issuer; }
        public void setIssuer(String issuer) { this.issuer = issuer; }
    }

    public static class RateLimit {
        private int loginPerMinute = 10;
        private int apiPerMinute = 100;

        public int getLoginPerMinute() { return loginPerMinute; }
        public void setLoginPerMinute(int loginPerMinute) { this.loginPerMinute = loginPerMinute; }
        public int getApiPerMinute() { return apiPerMinute; }
        public void setApiPerMinute(int apiPerMinute) { this.apiPerMinute = apiPerMinute; }
    }
}
