package com.stockez.api.module.realtime;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tells every open screen of a company that something changed, so it can refetch. Carries no
 * data — only "something changed" and which browser tab caused it — so nothing can leak across
 * tenants and the screens stay the single source of how to read data.
 */
@Service
@Slf4j
public class RealtimeService {

    private final Map<UUID, Set<SseEmitter>> byTenant = new ConcurrentHashMap<>();

    public SseEmitter subscribe(UUID tenantId) {
        SseEmitter emitter = new SseEmitter(0L);
        byTenant.computeIfAbsent(tenantId, k -> ConcurrentHashMap.newKeySet()).add(emitter);

        Runnable cleanup = () -> remove(tenantId, emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(e -> cleanup.run());

        try {
            emitter.send(SseEmitter.event().name("ready").data("ok"));
        } catch (IOException e) {
            cleanup.run();
        }
        return emitter;
    }

    public void publish(UUID tenantId, String originClientId) {
        Set<SseEmitter> emitters = byTenant.get(tenantId);
        if (emitters == null || emitters.isEmpty()) return;
        String origin = originClientId == null ? "" : originClientId;
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("change").data(origin));
            } catch (Exception e) {
                remove(tenantId, emitter);
            }
        }
    }

    /** Keeps proxies from closing an idle connection and prunes the ones that have gone away. */
    @Scheduled(fixedRate = 20000)
    public void heartbeat() {
        byTenant.forEach((tenantId, emitters) -> {
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event().comment("ping"));
                } catch (Exception e) {
                    remove(tenantId, emitter);
                }
            }
        });
    }

    private void remove(UUID tenantId, SseEmitter emitter) {
        Set<SseEmitter> emitters = byTenant.get(tenantId);
        if (emitters != null) {
            emitters.remove(emitter);
            if (emitters.isEmpty()) byTenant.remove(tenantId, emitters);
        }
    }
}
