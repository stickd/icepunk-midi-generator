package icepunk_backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "guest_usage")
public class GuestUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String ipAddress;

    private Integer generationsToday = 0;

    private LocalDate generationDate = LocalDate.now();

    public GuestUsage() {
    }

    public GuestUsage(String ipAddress) {
        this.ipAddress = ipAddress;
        this.generationsToday = 0;
        this.generationDate = LocalDate.now();
    }

    public Long getId() {
        return id;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public Integer getGenerationsToday() {
        return generationsToday;
    }

    public LocalDate getGenerationDate() {
        return generationDate;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public void setGenerationsToday(Integer generationsToday) {
        this.generationsToday = generationsToday;
    }

    public void setGenerationDate(LocalDate generationDate) {
        this.generationDate = generationDate;
    }
}