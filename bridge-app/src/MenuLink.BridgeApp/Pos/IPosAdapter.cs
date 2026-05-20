using MenuLink.BridgeApp.Models;

namespace MenuLink.BridgeApp.Pos;

/// <summary>
/// Abstraction for "write a MenuLink order to a restaurant's POS".
/// One implementation per POS (RzRz today; Foodics / others later).
/// </summary>
public interface IPosAdapter
{
    /// <summary>
    /// Push a MenuLink order into the POS. Returns the POS-side identifiers
    /// so the Bridge App can record them in pos_outbox.
    /// </summary>
    Task<PosWriteResult> WriteOrderAsync(OutboxPayload payload, CancellationToken ct);
}
