package io.innait.wiam.common.test;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.oracle.OracleContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class OracleTestContainerConfig {

    private static final String ORACLE_IMAGE = "gvenzl/oracle-xe:21-slim";

    @Bean
    @ServiceConnection
    public OracleContainer oracleContainer() {
        return new OracleContainer(DockerImageName.parse(ORACLE_IMAGE))
                .withDatabaseName("testdb")
                .withUsername("wiam_test")
                .withPassword("wiam_test")
                .withReuse(true);
    }
}
