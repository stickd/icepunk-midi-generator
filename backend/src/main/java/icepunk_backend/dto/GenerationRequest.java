package icepunk_backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public class GenerationRequest {

    private GenerationSource source = GenerationSource.FACTORY;

    @Min(1)
    @Max(34)
    private int amount = 10;

    @Size(max = 120)
    private String packName = "IcePunk Pack";

    private GenerationType type = GenerationType.MELODY;

    @Min(40)
    @Max(240)
    private int bpm = 146;

    @Min(-12)
    @Max(12)
    private int pitch = 0;

    @Min(1)
    @Max(4)
    private int octaves = 1;

    private String tempAnalysisId;
    private PublishMode publishMode = PublishMode.PUBLIC;

    public GenerationSource getSource() {
        return source;
    }

    public void setSource(GenerationSource source) {
        this.source = source;
    }

    public int getAmount() {
        return amount;
    }

    public void setAmount(int amount) {
        this.amount = amount;
    }

    public String getPackName() {
        return packName;
    }

    public void setPackName(String packName) {
        this.packName = packName;
    }

    public GenerationType getType() {
        return type;
    }

    public void setType(GenerationType type) {
        this.type = type;
    }

    public int getBpm() {
        return bpm;
    }

    public void setBpm(int bpm) {
        this.bpm = bpm;
    }

    public int getPitch() {
        return pitch;
    }

    public void setPitch(int pitch) {
        this.pitch = pitch;
    }

    public int getOctaves() {
        return octaves;
    }

    public void setOctaves(int octaves) {
        this.octaves = octaves;
    }

    public String getTempAnalysisId() {
        return tempAnalysisId;
    }

    public void setTempAnalysisId(String tempAnalysisId) {
        this.tempAnalysisId = tempAnalysisId;
    }

    public PublishMode getPublishMode() {
        return publishMode;
    }

    public void setPublishMode(PublishMode publishMode) {
        this.publishMode = publishMode;
    }

    public enum GenerationSource {
        FACTORY,
        CUSTOM_UPLOAD
    }

    public enum GenerationType {
        MELODY,
        DRUMS
    }

    public enum PublishMode {
        PUBLIC,
        PRIVATE
    }
}
