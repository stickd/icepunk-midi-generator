package icepunk_backend.service;

import java.nio.file.Path;

final class PythonExecutableResolver {

    private PythonExecutableResolver() {
    }

    static Path resolve(String configuredPythonPath, Path projectDir) {
        return resolve(configuredPythonPath, projectDir, System.getProperty("os.name", ""));
    }

    static Path resolve(String configuredPythonPath, Path projectDir, String osName) {
        if (configuredPythonPath != null && !configuredPythonPath.isBlank()) {
            return Path.of(configuredPythonPath).toAbsolutePath().normalize();
        }

        if (isWindows(osName)) {
            return projectDir.resolve("venv").resolve("Scripts").resolve("python.exe").normalize();
        }

        return projectDir.resolve("venv").resolve("bin").resolve("python3").normalize();
    }

    private static boolean isWindows(String osName) {
        return osName != null && osName.toLowerCase().contains("win");
    }
}
