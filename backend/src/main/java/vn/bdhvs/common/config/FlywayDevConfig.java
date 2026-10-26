package vn.bdhvs.common.config;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.flyway.FlywayConfigurationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DelegatingDataSource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.boot.autoconfigure.flyway.FlywayProperties;

/**
 * CHỈ DÙNG KHI DEV. SQL Server 2022 trong Docker Desktop/WSL2 (kernel 6.6) lỗi khi chạy sp_getapplock
 * ("xp_userlock ... Could not load the DLL (server internal) ... Reason: 126"), khiến Flyway không lấy được lock.
 * Lock này chỉ cần khi nhiều instance cùng migrate; môi trường dev chạy một instance nên bỏ qua được.
 * Bật bằng app.dev.flyway-skip-applock=true (đã bật ở profile dev). Staging/production không bật.
 */
@Configuration
@ConditionalOnProperty(name = "app.dev.flyway-skip-applock", havingValue = "true")
public class FlywayDevConfig {

    private static final Logger log = LoggerFactory.getLogger(FlywayDevConfig.class);

    @Bean
    FlywayConfigurationCustomizer skipAppLock(FlywayProperties flyway,
            org.springframework.boot.autoconfigure.jdbc.DataSourceProperties ds) {
        log.warn("Flyway đang bỏ qua sp_getapplock (app.dev.flyway-skip-applock=true). Không bật ở production.");
        DriverManagerDataSource target = new DriverManagerDataSource(ds.getUrl(), flyway.getUser(), flyway.getPassword());
        return config -> config.dataSource(new NoAppLockDataSource(target));
    }

    static final class NoAppLockDataSource extends DelegatingDataSource {

        NoAppLockDataSource(DataSource target) {
            super(target);
        }

        @Override
        public Connection getConnection() throws java.sql.SQLException {
            return wrap(super.getConnection());
        }

        @Override
        public Connection getConnection(String username, String password) throws java.sql.SQLException {
            return wrap(super.getConnection(username, password));
        }

        private static Connection wrap(Connection c) {
            return (Connection) Proxy.newProxyInstance(Connection.class.getClassLoader(), new Class<?>[] {Connection.class},
                    (proxy, method, args) -> {
                        if ((method.getName().equals("prepareStatement") || method.getName().equals("prepareCall"))
                                && args != null && args[0] instanceof String sql) {
                            if (sql.contains("sp_getapplock")) {
                                args[0] = "DECLARE @r NVARCHAR(255) = ?; SELECT 0";
                            } else if (sql.contains("sp_releaseapplock")) {
                                args[0] = "DECLARE @r NVARCHAR(255) = ?; SELECT 1";
                            }
                        }
                        try {
                            return method.invoke(c, args);
                        } catch (InvocationTargetException e) {
                            throw e.getCause();
                        }
                    });
        }
    }
}
