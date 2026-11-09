package com.femina;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import com.femina.config.AppProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
@MapperScan("com.femina.mapper")
public class FeminaApplication {

    public static void main(String[] args) {
        SpringApplication.run(FeminaApplication.class, args);
    }
}
