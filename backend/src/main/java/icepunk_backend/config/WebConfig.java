package icepunk_backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String uploadsPath = Paths.get(System.getProperty("user.dir"), "user_uploads").toAbsolutePath().toUri().toString();
        if (!uploadsPath.endsWith("/")) {
            uploadsPath = uploadsPath + "/";
        }
        registry.addResourceHandler("/user-uploads/**")
                .addResourceLocations(uploadsPath);
    }
}
