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
    Task<PosWriteResult> WriteOrderAsync(OutboxPayload payload, long menuLinkInvoiceNo, CancellationToken ct);

    /// <summary>POS family ("rzrz", "foodics", …) — reported in the heartbeat.</summary>
    string Kind { get; }

    /// <summary>
    /// The POS database this instance is actually pointed at. Surfaced in the
    /// heartbeat so /admin/pos can show it: the bridge's connection string
    /// defaults to a database literally named "client", which exists on every
    /// branch machine, so "it's running" is not the same as "it's running
    /// against the right box".
    /// </summary>
    string DatabaseName { get; }
}
