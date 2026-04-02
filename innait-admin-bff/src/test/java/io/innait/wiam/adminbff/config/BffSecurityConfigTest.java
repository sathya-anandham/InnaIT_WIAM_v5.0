package io.innait.wiam.adminbff.config;

import io.innait.wiam.common.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BffSecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockBean
    private StringRedisTemplate stringRedisTemplate;

    @Nested
    class CsrfProtection {

        @Test
        void shouldReturn403WhenCsrfTokenMissing() throws Exception {
            mockMvc.perform(post("/api/v1/self/credentials/password/change")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"currentPassword\":\"old\",\"newPassword\":\"new\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        void shouldAcceptRequestWithValidCsrfToken() throws Exception {
            // With csrf() processor, Spring Security test adds valid CSRF token
            mockMvc.perform(post("/api/v1/self/credentials/password/change")
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"currentPassword\":\"old\",\"newPassword\":\"new\"}"))
                    .andExpect(status().isUnauthorized()); // 401 because no JWT, not 403
        }
    }

    @Nested
    class PublicEndpoints {

        @Test
        void shouldAllowHealthEndpoint() throws Exception {
            mockMvc.perform(get("/actuator/health"))
                    .andExpect(status().isOk());
        }

        @Test
        void shouldAllowSwaggerUi() throws Exception {
            mockMvc.perform(get("/swagger-ui/index.html"))
                    .andExpect(status().isOk().reason((String) null))
                    .andReturn();
            // Swagger redirect or serve — just not 401/403
        }

        @Test
        void shouldRequireAuthForProtectedEndpoints() throws Exception {
            mockMvc.perform(get("/api/v1/self/profile"))
                    .andExpect(status().isUnauthorized());
        }
    }
}
