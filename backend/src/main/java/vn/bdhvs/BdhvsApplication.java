package vn.bdhvs;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
@EnableAsync
public class BdhvsApplication {

    public static void main(String[] args) {
        // Mọi cột DATETIME2 lưu UTC (design-db 01 §6); Timestamp <-> Instant phải quy đổi theo UTC.
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        SpringApplication.run(BdhvsApplication.class, args);
    }
}
