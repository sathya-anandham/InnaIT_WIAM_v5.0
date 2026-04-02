package io.innait.wiam.common.config;

import io.innait.wiam.common.context.TenantContext;
import jakarta.persistence.EntityManager;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.hibernate.Session;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Aspect
@Component
public class HibernateFilterConfig {

    private final EntityManager entityManager;

    public HibernateFilterConfig(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Before("execution(* io.innait.wiam..*.repository.*.*(..))")
    public void enableFilters() {
        Session session = entityManager.unwrap(Session.class);

        UUID tenantId = TenantContext.getTenantId();
        if (tenantId != null) {
            session.enableFilter("tenantFilter")
                    .setParameter("tenantId", tenantId);
        }

        session.enableFilter("softDeleteFilter")
                .setParameter("isDeleted", 0);
    }
}
