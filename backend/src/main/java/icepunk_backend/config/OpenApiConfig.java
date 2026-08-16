package icepunk_backend.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI icepunkOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("iCEPUNK MIDI Generator API")
                        .description("Generate dark-ambient MIDI packs. Auth is stateless JWT; "
                                + "public endpoints: /auth/register, /auth/login, /generate, /generation-stats.")
                        .version("v1"));
    }
}
